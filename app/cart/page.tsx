'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, app } from '@/app/firebase/config';
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';

interface ApiEntry {
  id: string;
  API: string;
  Description: string;
  Link: string;
  Category: string;
  Auth: string;
  isPaid: boolean;
  price: number;
}

export default function CartPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cartIds, setCartIds] = useState<string[]>([]);
  const [cartApis, setCartApis] = useState<ApiEntry[]>([]);
  const [purchasedAPIs, setPurchasedAPIs] = useState<string[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push('/sign-in');
        return;
      }
      setUser(currentUser);
      try {
        const db = getFirestore(app);
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          const ids: string[] = data.cart || [];
          setCartIds(ids);
          setPurchasedAPIs(data.purchasedAPIs || []);
          // Fetch full API docs
          if (ids.length > 0) {
            const promises = ids.map((id) => getDoc(doc(db, 'apis', id)));
            const docs = await Promise.all(promises);
            const apis = docs
              .filter((d) => d.exists())
              .map((d) => ({ id: d.id, ...d.data() } as ApiEntry));
            setCartApis(apis);
          }
        }
      } catch (err) {
        console.error('Error loading cart:', err);
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleRemove = async (apiId: string) => {
    const newIds = cartIds.filter((id) => id !== apiId);
    setCartIds(newIds);
    setCartApis((prev) => prev.filter((a) => a.id !== apiId));
    try {
      const db = getFirestore(app);
      await updateDoc(doc(db, 'users', user.uid), { cart: newIds });
    } catch (err) {
      console.error('Error removing from cart:', err);
    }
  };

  const handleCheckoutSingle = (apiId: string) => {
    router.push(`/checkout?apiId=${apiId}`);
  };

  // Only paid APIs that user hasn't purchased yet can be checked out
  const checkoutApis = cartApis.filter(
    (a) => a.isPaid && !purchasedAPIs.includes(a.id)
  );
  const total = checkoutApis.reduce((sum, a) => sum + (a.price || 0), 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50 backdrop-blur-md bg-white/80">
        <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => router.push('/')}>
            <img src="/APILogo.png" alt="Logo" className="w-8 h-8 object-contain" />
            <span className="text-xl font-bold text-gray-900">API Store</span>
          </div>
          <button
            onClick={() => router.push('/')}
            className="text-gray-500 hover:text-gray-700 font-medium text-sm transition-colors"
          >
            ← Back to Home
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-8 flex items-center gap-3">
          🛒 Your Cart
          {cartApis.length > 0 && (
            <span className="text-sm font-normal text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
              {cartApis.length} {cartApis.length === 1 ? 'item' : 'items'}
            </span>
          )}
        </h1>

        {cartApis.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 shadow-lg text-center">
            <div className="text-5xl mb-4">🛒</div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">Your cart is empty</h2>
            <p className="text-gray-500 mb-6">Add paid APIs to your cart from the marketplace to purchase them.</p>
            <button
              onClick={() => router.push('/')}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition"
            >
              Explore APIs
            </button>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              {cartApis.map((api) => {
                const alreadyPurchased = purchasedAPIs.includes(api.id);
                return (
                  <div
                    key={api.id}
                    className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-semibold text-gray-800">{api.API}</h3>
                          {alreadyPurchased && (
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                              ✓ Already Purchased
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{api.Description}</p>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded font-medium">
                            {api.Category}
                          </span>
                          {api.Auth && (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                              {api.Auth}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 ml-4">
                        {api.isPaid ? (
                          <span className="text-xl font-bold text-gray-900">₹{api.price.toFixed(2)}</span>
                        ) : (
                          <span className="text-lg font-bold text-green-600">FREE</span>
                        )}
                        <div className="flex gap-2">
                          {api.isPaid && !alreadyPurchased && (
                            <button
                              onClick={() => handleCheckoutSingle(api.id)}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg font-semibold transition"
                            >
                              Buy Now
                            </button>
                          )}
                          <button
                            onClick={() => handleRemove(api.id)}
                            className="px-3 py-1.5 bg-gray-100 hover:bg-red-50 text-gray-600 hover:text-red-600 text-xs rounded-lg font-medium transition"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Order Summary Sidebar */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-lg sticky top-24">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Order Summary</h3>
                <div className="space-y-3 mb-4">
                  {checkoutApis.map((api) => (
                    <div key={api.id} className="flex justify-between items-center text-sm">
                      <span className="text-gray-700 truncate mr-2">{api.API}</span>
                      <span className="font-medium text-gray-900 whitespace-nowrap">₹{api.price.toFixed(2)}</span>
                    </div>
                  ))}
                  {checkoutApis.length === 0 && (
                    <p className="text-sm text-gray-500">No purchasable items in cart.</p>
                  )}
                </div>
                <div className="border-t border-gray-200 pt-4 mb-6">
                  <div className="flex justify-between items-center">
                    <span className="text-base font-semibold text-gray-800">Total</span>
                    <span className="text-2xl font-bold text-blue-600">₹{total.toFixed(2)}</span>
                  </div>
                </div>

                {checkoutApis.length === 1 && (
                  <button
                    onClick={() => handleCheckoutSingle(checkoutApis[0].id)}
                    className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition shadow-md shadow-blue-100"
                  >
                    Proceed to Checkout
                  </button>
                )}

                {checkoutApis.length > 1 && (
                  <div className="space-y-2">
                    {checkoutApis.map((api) => (
                      <button
                        key={api.id}
                        onClick={() => handleCheckoutSingle(api.id)}
                        className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition text-sm"
                      >
                        Buy {api.API} — ₹{api.price.toFixed(2)}
                      </button>
                    ))}
                  </div>
                )}

                {checkoutApis.length === 0 && (
                  <button
                    onClick={() => router.push('/')}
                    className="w-full px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-lg transition"
                  >
                    Browse APIs
                  </button>
                )}

                <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <p className="text-xs text-gray-500 text-center leading-relaxed">
                    🔒 Secure checkout powered by Stripe.<br />
                    Test card: <code className="font-mono bg-gray-200 px-1 rounded">4242 4242 4242 4242</code><br />
                    Any future date · Any CVC
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
