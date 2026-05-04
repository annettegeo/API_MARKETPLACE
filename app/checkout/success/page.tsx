'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/app/firebase/config';
import { getFirestore, doc, getDoc, updateDoc, arrayUnion, arrayRemove, increment, addDoc, collection } from 'firebase/firestore';

function SuccessPageInner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const paymentIntent = searchParams.get('payment_intent');
    const apiId = searchParams.get('apiId');

    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');
    const [apiData, setApiData] = useState<any>(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            if (!currentUser) {
                router.push('/sign-in');
            } else {
                setUser(currentUser);
            }
        });

        return () => unsubscribe();
    }, [router]);

    useEffect(() => {
        if (!paymentIntent || !apiId || !user) return;

        const processPayment = async () => {
            try {
                setLoading(true);
                const db = getFirestore();

                // Note: In production, verify payment server-side
                // For now, we'll trust the payment_intent parameter

                // Get API data
                const apiDoc = await getDoc(doc(db, 'apis', apiId));
                if (!apiDoc.exists()) {
                    setError('API not found');
                    return;
                }

                const api = { id: apiDoc.id, ...apiDoc.data() } as any;
                setApiData(api);

                // Check if user already purchased this API
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                const userData = userDoc.data();

                if (userData?.purchasedAPIs?.includes(apiId)) {
                    setSuccess(true);
                    setLoading(false);
                    return;
                }

                // Update buyer's purchasedAPIs and remove from cart
                await updateDoc(doc(db, 'users', user.uid), {
                    purchasedAPIs: arrayUnion(apiId),
                    cart: arrayRemove(apiId),
                });

                // Update seller's earnings (if seller exists)
                if (api.userId) {
                    const sellerDocRef = doc(db, 'users', api.userId);
                    const sellerDoc = await getDoc(sellerDocRef);

                    if (sellerDoc.exists()) {
                        await updateDoc(sellerDocRef, {
                            earnings: increment(api.price),
                        });
                    }
                }

                // Record transaction
                await addDoc(collection(db, 'transactions'), {
                    buyerId: user.uid,
                    buyerEmail: user.email,
                    sellerId: api.userId || null,
                    apiId: apiId,
                    apiName: api.API,
                    amount: api.price,
                    paymentIntentId: paymentIntent,
                    createdAt: new Date().toISOString(),
                });

                setSuccess(true);
            } catch (err) {
                console.error('Payment processing error:', err);
                setError('Failed to process payment. Please contact support.');
            } finally {
                setLoading(false);
            }
        };

        processPayment();
    }, [paymentIntent, apiId, user]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="text-gray-800 text-2xl mb-4">Processing payment...</div>
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-50 flex items-center justify-center">
                <div className="bg-white p-8 rounded-lg shadow-lg border border-gray-200 max-w-md">
                    <div className="text-center mb-6">
                        <div className="text-6xl mb-4">❌</div>
                        <h1 className="text-2xl font-bold text-red-600 mb-4">Payment Error</h1>
                        <p className="text-gray-700">{error}</p>
                    </div>
                    <button
                        onClick={() => router.push('/')}
                        className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition"
                    >
                        Back to Home
                    </button>
                </div>
            </div>
        );
    }

    if (!success || !apiData) {
        return null;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-50">
            <header className="bg-white border-b border-gray-100 sticky top-0 z-50 backdrop-blur-md bg-white/80">
                <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => router.push('/')}>
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

            <div className="max-w-2xl mx-auto px-6 py-12">
                <div className="bg-white rounded-lg border border-gray-200 p-8 shadow-lg text-center">
                    <div className="text-6xl mb-6">✅</div>
                    <h2 className="text-3xl font-bold text-green-600 mb-4">Payment Successful!</h2>
                    <p className="text-gray-700 text-lg mb-8">
                        You now have access to <strong>{apiData.API}</strong>
                    </p>

                    <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
                        <div className="flex items-center justify-center gap-2 mb-4">
                            <span className="text-green-600 font-semibold text-lg">✓ Access Granted</span>
                        </div>
                        <div className="bg-white rounded border border-green-300 p-4">
                            <p className="text-sm text-gray-600 mb-2">API Endpoint:</p>
                            <code className="text-blue-600 font-mono break-all">{apiData.endpoint || apiData.Link}</code>
                        </div>
                    </div>

                    <div className="border-t border-gray-200 pt-6">
                        <div className="grid grid-cols-2 gap-4 text-left mb-6">
                            <div>
                                <p className="text-sm text-gray-600">API Name</p>
                                <p className="font-semibold text-gray-800">{apiData.API}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Amount Paid</p>
                                <p className="font-semibold text-gray-800">₹{(apiData.price).toFixed(2)}</p>
                            </div>
                            <div className="col-span-2">
                                <p className="text-sm text-gray-600">Description</p>
                                <p className="text-gray-700">{apiData.Description}</p>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={() => router.push('/')}
                                className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition"
                            >
                                Browse More APIs
                            </button>
                            <button
                                onClick={() => router.push('/dashboard')}
                                className="flex-1 px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded-lg transition"
                            >
                                View Dashboard
                            </button>
                        </div>
                    </div>
                </div>

                <div className="mt-6 text-center text-sm text-gray-600">
                    <p>Transaction ID: {paymentIntent}</p>
                    <p className="mt-2">You can view this API in your dashboard at any time.</p>
                </div>
            </div>
        </div>
    );
}

export default function SuccessPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>}>
            <SuccessPageInner />
        </Suspense>
    );
}

