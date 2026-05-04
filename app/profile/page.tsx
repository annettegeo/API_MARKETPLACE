'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, app } from '@/app/firebase/config';
import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
} from 'firebase/firestore';

interface ApiEntry {
  id?: string;
  API: string;
  Description: string;
  Link: string;
  Category: string;
  Auth: string;
  Cors: string;
  HTTPS: boolean;
  userId?: string;
  submittedAt?: string;
  status?: string;
  isPaid?: boolean;
  price?: number;
}

interface OrderEntry {
  id: string;
  apiId: string;
  apiName: string;
  amount: number;
  createdAt: string;
  paymentIntentId: string;
  buyerEmail?: string;
}

interface UserProfile {
  uid: string;
  email: string;
  githubLink?: string;
  username?: string;
  displayName?: string;
}

const ProfilePage: React.FC = () => {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [submittedApis, setSubmittedApis] = useState<ApiEntry[]>([]);
  const [githubLink, setGithubLink] = useState('');
  const [username, setUsername] = useState('');
  const [editingGithub, setEditingGithub] = useState(false);
  const [editingUsername, setEditingUsername] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingUsername, setSavingUsername] = useState(false);
  const [activeTab, setActiveTab] = useState<'submitted' | 'wishlist' | 'orders'>('submitted');

  // Wishlist
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [wishlistApis, setWishlistApis] = useState<ApiEntry[]>([]);
  const [wishlistLoading, setWishlistLoading] = useState(false);

  // Orders
  const [orders, setOrders] = useState<OrderEntry[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser({
          uid: currentUser.uid,
          email: currentUser.email || '',
          displayName: currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
        });
        fetchUserProfile(currentUser.uid);
        fetchUserApis(currentUser.uid);
        await fetchWishlistIds(currentUser.uid);
        await fetchOrders(currentUser.uid);
      } else {
        router.push('/sign-in');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  // Fetch wishlist API objects when IDs change
  useEffect(() => {
    if (wishlistIds.length === 0) {
      setWishlistApis([]);
      return;
    }
    const fetchApis = async () => {
      setWishlistLoading(true);
      try {
        const db = getFirestore(app);
        const promises = wishlistIds.map((id) => getDoc(doc(db, 'apis', id)));
        const docs = await Promise.all(promises);
        const apis = docs
          .filter((d) => d.exists())
          .map((d) => ({ id: d.id, ...d.data() } as ApiEntry));
        setWishlistApis(apis);
      } catch (err) {
        console.error('Error fetching wishlist APIs:', err);
      } finally {
        setWishlistLoading(false);
      }
    };
    fetchApis();
  }, [wishlistIds]);

  const fetchWishlistIds = async (userId: string) => {
    try {
      const db = getFirestore(app);
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        setWishlistIds(userDoc.data().wishlist || []);
      }
    } catch (err) {
      console.error('Error fetching wishlist ids:', err);
    }
  };

  const fetchOrders = async (userId: string) => {
    setOrdersLoading(true);
    try {
      const db = getFirestore(app);
      const q = query(
        collection(db, 'transactions'),
        where('buyerId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const txns = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as OrderEntry));
      setOrders(txns);
    } catch (err) {
      console.error('Error fetching orders:', err);
    } finally {
      setOrdersLoading(false);
    }
  };

  const handleRemoveFromWishlist = async (apiId: string) => {
    if (!user) return;
    const newIds = wishlistIds.filter((id) => id !== apiId);
    setWishlistIds(newIds);
    try {
      const db = getFirestore(app);
      await updateDoc(doc(db, 'users', user.uid), { wishlist: newIds });
    } catch (err) {
      console.error('Error removing from wishlist:', err);
      setWishlistIds(wishlistIds);
    }
  };

  const fetchUserProfile = async (userId: string) => {
    try {
      const response = await fetch(`/api/user/profile?userId=${userId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.githubUrl) setGithubLink(data.githubUrl);
        if (data.username) setUsername(data.username);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const fetchUserApis = async (userId: string) => {
    try {
      const response = await fetch(`/api/user/apis?userId=${userId}`);
      if (response.ok) {
        const data = await response.json();
        setSubmittedApis(data.apis || []);
      }
    } catch (error) {
      console.error('Error fetching user APIs:', error);
    }
  };

  const saveGithubLink = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await fetch('/api/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid, githubUrl: githubLink.trim() }),
      });
      setEditingGithub(false);
    } catch (error) {
      console.error('Error saving GitHub link:', error);
    } finally {
      setSaving(false);
    }
  };

  const saveUsername = async () => {
    if (!user || !username.trim() || username.trim().length < 3) return;
    setSavingUsername(true);
    try {
      await fetch('/api/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid, username: username.trim() }),
      });
      setEditingUsername(false);
    } catch (error) {
      console.error('Error saving username:', error);
    } finally {
      setSavingUsername(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-800 text-2xl mb-4">Loading...</div>
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const tabs = [
    { id: 'submitted' as const, label: 'Submitted APIs', icon: '📤' },
    { id: 'wishlist' as const, label: 'Wishlist', icon: '❤️', count: wishlistIds.length },
    { id: 'orders' as const, label: 'Orders', icon: '📦', count: orders.length },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50 backdrop-blur-md bg-white/80">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => router.push('/')}>
              <img src="/APILogo.png" alt="Logo" className="w-8 h-8 object-contain" />
              <span className="text-xl font-bold text-gray-900">API Store</span>
            </div>
            <button
              onClick={() => router.push('/')}
              className="text-gray-500 hover:text-gray-700 font-medium text-sm transition-colors"
            >
              ← Back
            </button>
          </div>
          <button
            onClick={() => router.push('/submit-api')}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition font-bold text-xs uppercase tracking-wider shadow-md shadow-indigo-100"
          >
            Submit API
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* User Info Card */}
        <div className="bg-white rounded-lg border border-gray-200 p-8 mb-8 shadow-lg">
          <div className="flex items-start gap-6">
            <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center text-white text-2xl font-bold">
              {user.displayName?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">{user.displayName || 'User'}</h2>
              <p className="text-gray-600 mb-4">{user.email}</p>

              {/* Username */}
              <div className="mb-3 flex items-center gap-3">
                <span className="text-gray-700 font-semibold">Username:</span>
                {editingUsername ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. john_dev"
                      className="px-3 py-1 bg-gray-50 border border-gray-300 rounded text-gray-800 placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    />
                    <button
                      onClick={saveUsername}
                      disabled={savingUsername}
                      className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded text-sm transition"
                    >
                      {savingUsername ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => { setEditingUsername(false); fetchUserProfile(user!.uid); }}
                      className="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded text-sm transition"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-800 font-medium">@{username || 'not set'}</span>
                    <button
                      onClick={() => setEditingUsername(true)}
                      className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded text-sm transition"
                    >
                      {username ? 'Edit' : 'Add'}
                    </button>
                  </div>
                )}
              </div>

              {/* GitHub */}
              <div className="mb-4">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-gray-700 font-semibold">GitHub:</span>
                  {editingGithub ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="url"
                        value={githubLink}
                        onChange={(e) => setGithubLink(e.target.value)}
                        placeholder="https://github.com/username"
                        className="flex-1 px-3 py-1 bg-gray-50 border border-gray-300 rounded text-gray-800 placeholder-gray-500 focus:outline-none focus:border-blue-500"
                      />
                      <button
                        onClick={saveGithubLink}
                        disabled={saving}
                        className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded text-sm transition"
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => { setEditingGithub(false); fetchUserProfile(user.uid); }}
                        className="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded text-sm transition"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      {githubLink ? (
                        <a
                          href={githubLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-700 transition-colors"
                        >
                          {githubLink.replace('https://github.com/', '')}
                        </a>
                      ) : (
                        <span className="text-gray-500">Not set</span>
                      )}
                      <button
                        onClick={() => setEditingGithub(true)}
                        className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded text-sm transition"
                      >
                        {githubLink ? 'Edit' : 'Add'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-4 text-sm">
                <div className="px-3 py-1 bg-gray-100 rounded text-gray-700">
                  {submittedApis.length} API{submittedApis.length !== 1 ? 's' : ''} Submitted
                </div>
                <div className="px-3 py-1 bg-green-100 text-green-700 rounded">
                  {submittedApis.filter((a) => a.status === 'approved').length} Approved
                </div>
                <div className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded">
                  {submittedApis.filter((a) => a.status === 'pending').length} Pending Review
                </div>
                <div className="px-3 py-1 bg-red-50 text-red-600 rounded flex items-center gap-1">
                  ❤️ {wishlistIds.length} Wishlisted
                </div>
                <div className="px-3 py-1 bg-blue-50 text-blue-600 rounded flex items-center gap-1">
                  📦 {orders.length} Order{orders.length !== 1 ? 's' : ''}
                </div>
                <div className="px-3 py-1 bg-gray-100 rounded text-gray-700">
                  Member since {new Date().getFullYear()}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg border border-gray-200 p-1 mb-8 shadow-lg">
          <div className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                }`}
              >
                <span>{tab.icon}</span>
                <span className="font-medium">{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      activeTab === tab.id ? 'bg-white text-blue-600' : 'bg-blue-100 text-blue-600'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ===== TAB: Submitted APIs ===== */}
        {activeTab === 'submitted' && (
          <div className="bg-white rounded-lg border border-gray-200 p-8 shadow-lg">
            <h3 className="text-xl font-bold text-gray-800 mb-6">Your Submitted APIs</h3>
            {submittedApis.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-4">📤</div>
                <div className="text-gray-600 mb-4">You haven&apos;t submitted any APIs yet</div>
                <button
                  onClick={() => router.push('/submit-api')}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-semibold"
                >
                  Submit Your First API
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {submittedApis.map((api) => (
                  <div
                    key={api.API}
                    className="bg-gray-50 rounded-lg p-6 border border-gray-200 hover:border-blue-400 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h4 className="text-lg font-semibold text-gray-800">{api.API}</h4>
                      {api.status === 'approved' ? (
                        <span className="px-2 py-1 bg-green-600 text-white text-xs rounded font-medium">
                          ✓ Approved
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-yellow-500 text-white text-xs rounded font-medium">
                          ⏳ Pending
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600 text-sm mb-4 line-clamp-3">{api.Description}</p>
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded">
                        {api.Category}
                      </span>
                      <a
                        href={api.Link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700 text-sm transition-colors"
                      >
                        View Docs →
                      </a>
                    </div>
                    {api.submittedAt && (
                      <div className="mt-3 text-xs text-gray-500">
                        Submitted {new Date(api.submittedAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== TAB: Wishlist ===== */}
        {activeTab === 'wishlist' && (
          <div className="bg-white rounded-lg border border-gray-200 p-8 shadow-lg">
            <h3 className="text-xl font-bold text-gray-800 mb-6">
              Your Wishlist
              {wishlistIds.length > 0 && (
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({wishlistIds.length} {wishlistIds.length === 1 ? 'item' : 'items'})
                </span>
              )}
            </h3>

            {wishlistLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : wishlistApis.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-5xl mb-4">🤍</div>
                <div className="text-gray-600 mb-2 text-lg font-medium">Your wishlist is empty</div>
                <p className="text-gray-500 text-sm mb-6">
                  Like an API card on the home page to add it here.
                </p>
                <button
                  onClick={() => router.push('/')}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-semibold"
                >
                  Explore APIs
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {wishlistApis.map((api) => (
                  <div
                    key={api.id}
                    className="bg-gray-50 rounded-lg p-6 border border-gray-200 hover:border-red-300 transition-colors relative"
                  >
                    <button
                      onClick={() => handleRemoveFromWishlist(api.id!)}
                      className="absolute top-4 right-4 p-1.5 rounded-full bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-colors"
                      title="Remove from wishlist"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    </button>

                    <h4 className="text-lg font-semibold text-gray-800 pr-8 mb-1">{api.API}</h4>
                    <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded mb-3">
                      {api.Category}
                    </span>
                    <p className="text-gray-600 text-sm mb-4 line-clamp-3">{api.Description}</p>

                    <div className="flex items-center gap-2 flex-wrap text-xs mb-4">
                      {api.Auth && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded">{api.Auth}</span>
                      )}
                      {api.HTTPS && (
                        <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded">HTTPS</span>
                      )}
                      {api.isPaid ? (
                        <span className="px-2 py-0.5 bg-blue-600 text-white rounded">
                          ₹{api.price?.toFixed(2)}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-green-500 text-white rounded">FREE</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => router.push(`/?api=${api.API.toLowerCase().replace(/\s+/g, '-')}`)}
                        className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
                      >
                        View Details →
                      </button>
                      <a
                        href={api.Link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-500 hover:text-blue-600 hover:underline transition-colors"
                      >
                        Docs ↗
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== TAB: Orders ===== */}
        {activeTab === 'orders' && (
          <div className="bg-white rounded-lg border border-gray-200 p-8 shadow-lg">
            <h3 className="text-xl font-bold text-gray-800 mb-6">
              Your Orders
              {orders.length > 0 && (
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({orders.length} {orders.length === 1 ? 'order' : 'orders'})
                </span>
              )}
            </h3>

            {ordersLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-5xl mb-4">📦</div>
                <div className="text-gray-600 mb-2 text-lg font-medium">No orders yet</div>
                <p className="text-gray-500 text-sm mb-6">
                  Purchase a paid API to see your orders here.
                </p>
                <button
                  onClick={() => router.push('/')}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-semibold"
                >
                  Explore APIs
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => (
                  <div
                    key={order.id}
                    className="bg-gray-50 rounded-lg border border-gray-200 p-6 hover:border-blue-300 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="text-lg font-semibold text-gray-800">{order.apiName}</h4>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(order.createdAt).toLocaleDateString('en-IN', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-lg font-bold text-gray-900">
                          ₹{(order.amount / 100).toFixed(2)}
                        </span>
                        <span className="px-2.5 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                          ✓ Completed
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500 border-t border-gray-200 pt-3 mt-2">
                      <span>
                        Transaction: <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-[10px]">
                          {order.paymentIntentId?.slice(0, 22)}...
                        </code>
                      </span>
                      <button
                        onClick={() => router.push(`/?api=${order.apiName.toLowerCase().replace(/\s+/g, '-')}`)}
                        className="text-blue-600 hover:text-blue-700 font-medium"
                      >
                        View API →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
