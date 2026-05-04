import { NextRequest, NextResponse } from 'next/server';
import * as adminLib from 'firebase-admin';

// Initialize Firebase Admin SDK
if (!adminLib.apps.length) {
  try {
    adminLib.initializeApp({
      credential: adminLib.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  } catch (e) {
    console.error('Firebase Admin init error in /api/user/profile:', e);
  }
}

const db = adminLib.firestore();

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'User ID required' }, { status: 400 });
  }

  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json({});
    }
    const data = userDoc.data()!;
    return NextResponse.json({
      username: data.username || null,
      email: data.email || null,
      githubUrl: data.githubUrl || null,
      linkedinUrl: data.linkedinUrl || null,
      createdAt: data.createdAt || null,
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, username, email, githubUrl, linkedinUrl, isNewUser } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const userRef = db.collection('users').doc(userId);

    if (isNewUser) {
      // For Google sign-ups: only set fields if doc doesn't already exist
      const existing = await userRef.get();
      if (!existing.exists) {
        await userRef.set({
          username: username || null,
          email: email || null,
          credits: 0,
          purchasedAPIs: [],
          wishlist: [],
          cart: [],
          earnings: 0,
          createdAt: new Date().toISOString(),
        });
      }
    } else {
      // For email sign-ups or profile updates: merge fields
      const updateData: Record<string, any> = {};
      if (username !== undefined) updateData.username = username;
      if (email !== undefined) updateData.email = email;
      if (githubUrl !== undefined) updateData.githubUrl = githubUrl;
      if (linkedinUrl !== undefined) updateData.linkedinUrl = linkedinUrl;

      await userRef.set({
        ...updateData,
        credits: 0,
        purchasedAPIs: [],
        wishlist: [],
        cart: [],
        earnings: 0,
        createdAt: new Date().toISOString(),
      }, { merge: true });
    }

    return NextResponse.json({ message: 'Profile saved successfully' });
  } catch (error) {
    console.error('Error saving user profile:', error);
    return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 });
  }
}
