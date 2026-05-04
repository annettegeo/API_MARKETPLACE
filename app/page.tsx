'use client';

import React, { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/app/firebase/config';
import { getFirestore, collection, getDocs, query, orderBy, limit, doc, updateDoc, arrayUnion, increment, addDoc, getDoc, where } from 'firebase/firestore';
import Chatbot from '@/app/components/Chatbot';

// --- Interfaces for Type Safety ---
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
  isPaid: boolean;
  price: number;
  endpoint?: string;
}

interface ScrapedData {
  overview?: string;
  examples?: string[];
  requirements?: string[];
  isRestApi?: boolean;
  error?: string;
}

interface ApiDetails extends ApiEntry {
  scraped?: ScrapedData;
}

interface ApiCardProps {
  title: string;
  description: string;
  tags: string[];
  featured?: boolean;
  category: string;
  link: string;
  auth: string;
  onClick?: () => void;
}

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'filter';
  isActive?: boolean;
  className?: string;
}

// --- Helper Function ---
const slugify = (str: string) =>
  str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

// --- Reusable UI Components ---

const Button = ({ children, onClick, variant = 'primary', isActive = false, className = '' }: ButtonProps) => {
  const getStyles = () => {
    if (variant === 'filter') {
      return {
        backgroundColor: isActive ? '#4F46E5' : '#F3F4FB',
        color: isActive ? '#FFFFFF' : '#4B5563',
        border: isActive ? '2px solid #6366F1' : '2px solid transparent',
      };
    }
    if (variant === 'secondary') {
      return {
        backgroundColor: '#FFFFFF',
        color: '#374151',
        border: '1px solid #E5E7EB',
      };
    }
    return {
      backgroundColor: '#4F46E5',
      color: '#FFFFFF',
      border: 'none',
    };
  };

  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:opacity-90 ${className}`}
      style={getStyles()}
    >
      {children}
    </button>
  );
};

const ApiCard = ({ title, description, tags, featured, category, link, auth, onClick, isOwner }: ApiCardProps & { isOwner?: boolean }) => (
  <div
    onClick={onClick}
    className={`rounded-xl shadow-sm hover:shadow-md transition-all duration-300 p-6 h-full flex flex-col cursor-pointer bg-white border border-slate-300 hover:border-indigo-500`}
    style={{
      transform: featured ? 'scale(1.02)' : 'scale(1)',
      boxShadow: featured ? '0 10px 25px -5px rgba(79, 70, 229, 0.1), 0 8px 10px -6px rgba(79, 70, 229, 0.1)' : '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)'
    }}
  >
    <div className="flex items-start justify-between mb-2">
      <h3 className={`${featured ? 'text-xl' : 'text-lg'} font-bold text-gray-900`}>
        {title}
      </h3>
      {isOwner && (
        <span className="px-2 py-1 bg-green-500 text-white text-[10px] rounded-full font-bold uppercase tracking-wider">
          Owner
        </span>
      )}
    </div>
    <p className={`mb-3 flex-grow ${featured ? 'text-base' : 'text-sm'} text-gray-600 leading-relaxed`}>
      {description}
    </p>
    <div className="flex flex-wrap gap-2 mt-2">
      {tags.filter(tag => tag).map((tag) => (
        <span
          key={tag}
          className="px-2 py-1 rounded-md text-[11px] font-semibold bg-gray-50 text-gray-500 border border-gray-100"
        >
          {tag}
        </span>
      ))}
    </div>
    <div className="mt-5 pt-4 border-t border-gray-50 flex justify-between items-center">
      <span
        className="text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-tight bg-indigo-50 text-indigo-600"
      >
        {category}
      </span>
      <a
        href={link}
        onClick={(e) => e.stopPropagation()}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm font-semibold text-blue-600 hover:text-blue-700 hover:underline"
      >
        View Docs
      </a>
    </div>
  </div>
);

const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-white">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
  </div>
);

const InfoMessage = ({ message }: { message: string }) => (
  <div className="min-h-screen flex items-center justify-center bg-white">
    <div className="text-xl text-gray-600 font-medium">{message}</div>
  </div>
);

// --- Featured APIs Constant ---
const FEATURED_APIS = [
  {
    API: "HaveIBeenPwned",
    Description: "Passwords which have previously been exposed in data breaches",
    Category: "Security",
    Link: "https://haveibeenpwned.com/API/v3#PwnedPasswords",
    Auth: "apiKey",
    Cors: "yes",
    tags: ["security", "breaches", "passwords"]
  },
  {
    API: "VirusTotal",
    Description: "Analyze suspicious files, URLs, IP addresses, and domains to detect malware and cyber threats",
    Category: "Security",
    Link: "https://developers.virustotal.com/reference",
    Auth: "apiKey",
    Cors: "yes",
    tags: ["security", "malware", "threat-detection"]
  },
  {
    API: "Bitly",
    Description: "URL shortening and link management platform with detailed analytics",
    Category: "URL Shortener",
    Link: "https://dev.bitly.com/",
    Auth: "OAuth",
    Cors: "yes",
    tags: ["url", "analytics", "links"]
  },
  {
    API: "QR code",
    Description: "Create an easy to read QR code and URL shortener",
    Auth: "",
    HTTPS: true,
    Cors: "yes",
    Link: "https://www.qrtag.net/api/",
    Category: "Development",
    tags: ["qr", "generator", "scanning"]
  },
  {
    API: "Shodan",
    Description: "Search engine for Internet-connected devices and cyber security intelligence",
    Category: "Security",
    Link: "https://developer.shodan.io/api",
    Auth: "apiKey",
    Cors: "yes",
    tags: ["security", "devices", "scanning"]
  },
  {
    API: "Abstract Email Validation",
    Description: "Verify email address validity and detect disposable email providers",
    Category: "Validation",
    Link: "https://www.abstractapi.com/email-verification-validation-api",
    Auth: "apiKey",
    Cors: "yes",
    tags: ["email", "validation", "verification"]
  },
  {
    API: "New API",
    Description: "New API description",
    Category: "New Category",
    Link: "https://new-api.com",
    Auth: "apiKey",
    Cors: "yes",
    tags: ["new", "api", "category"]
  }
];

// --- Landing Page Component ---
function LandingPage({ onApiSelect }: { onApiSelect: (apiId: string, name?: string) => void }) {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [apis, setApis] = useState<ApiEntry[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<ApiEntry[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [cart, setCart] = useState<string[]>([]);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [purchasedAPIs, setPurchasedAPIs] = useState<string[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadApis = async () => {
      try {
        const { getFirestore, collection, getDocs, query } = await import('firebase/firestore');
        const { app } = await import('@/app/firebase/config');
        const db = getFirestore(app);

        // Fetch all APIs. We don't filter by 'status == approved' because bulk-imported
        // APIs from the public API list might not have a 'status' field set.
        // Pending submissions are safely isolated in the 'pending_apis' collection.
        const apisSnapshot = await getDocs(query(collection(db, 'apis')));
        const apisData = apisSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ApiEntry[];

        setApis(apisData);
        const uniqueCategories = [...new Set(apisData.map((api: ApiEntry) => api.Category))] as string[];
        setCategories(uniqueCategories);
      } catch (error) {
        console.error('Error loading APIs:', error);
        setApis([]);
      } finally {
        setLoading(false);
      }
    };
    loadApis();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        // Ensure admin-session is set if user is admin
        try {
          const idTokenResult = await currentUser.getIdTokenResult();
          if (idTokenResult.claims.admin) {
            const token = await currentUser.getIdToken();
            await fetch('/api/admin-session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ idToken: token })
            });
          }
        } catch (e) {
          console.error('Failed to set admin session:', e);
        }

        // Fetch user's purchased APIs + wishlist
        try {
          const { getFirestore, doc, getDoc } = await import('firebase/firestore');
          const { app } = await import('@/app/firebase/config');
          const db = getFirestore(app);

          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setPurchasedAPIs(userData.purchasedAPIs || []);
            setWishlist(userData.wishlist || []);
            setCart(userData.cart || []);
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      }

      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        !searchInputRef.current?.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowUserDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev => {
      if (prev.includes(tag)) {
        return prev.filter(t => t !== tag);
      } else {
        return [...prev, tag];
      }
    });
  };

  const handleRemoveTag = (tag: string) => {
    setSelectedTags(prev => prev.filter(t => t !== tag));
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);

    if (value.trim()) {
      const filtered = apis
        .filter(api => {
          const searchLower = value.toLowerCase();
          return (
            api.API.toLowerCase().includes(searchLower) ||
            api.Description.toLowerCase().includes(searchLower) ||
            api.Category.toLowerCase().includes(searchLower)
          );
        })
        .slice(0, 8);

      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (api: ApiEntry) => {
    setSearchQuery('');
    setShowSuggestions(false);
    onApiSelect(api.id!, api.API);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      const trimmedQuery = searchQuery.trim();
      if (!selectedTags.includes(trimmedQuery)) {
        setSelectedTags(prev => [...prev, trimmedQuery]);
      }
      setSearchQuery('');
      setShowSuggestions(false);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const handleWishlistToggle = async (apiId: string) => {
    if (!user) return;
    const isLiked = wishlist.includes(apiId);
    const newWishlist = isLiked
      ? wishlist.filter(id => id !== apiId)
      : [...wishlist, apiId];
    setWishlist(newWishlist);
    try {
      const { getFirestore, doc, updateDoc } = await import('firebase/firestore');
      const { app } = await import('@/app/firebase/config');
      const db = getFirestore(app);
      await updateDoc(doc(db, 'users', user.uid), { wishlist: newWishlist });
    } catch (error) {
      console.error('Error updating wishlist:', error);
      setWishlist(wishlist); // revert on error
    }
  };

  const handleCartToggle = async (apiId: string) => {
    if (!user) return;
    const isInCartNow = cart.includes(apiId);
    const newCart = isInCartNow ? cart.filter(id => id !== apiId) : [...cart, apiId];
    setCart(newCart);
    try {
      const { getFirestore, doc, updateDoc } = await import('firebase/firestore');
      const { app } = await import('@/app/firebase/config');
      const db = getFirestore(app);
      await updateDoc(doc(db, 'users', user.uid), { cart: newCart });
    } catch (error) {
      console.error('Error updating cart:', error);
      setCart(cart);
    }
  };

  const filteredApis = apis.filter(api => {
    if (selectedTags.length === 0) {
      return true;
    }

    return selectedTags.some(tag => {
      const tagLower = tag.toLowerCase();
      return (
        api.API.toLowerCase().includes(tagLower) ||
        api.Description.toLowerCase().includes(tagLower) ||
        api.Category.toLowerCase().includes(tagLower)
      );
    });
  });

  const displayedCategories = showAllCategories ? categories : categories.slice(0, 9);

  const featureCards = [
    {
      title: "Discover APIs",
      description: "Browse through hundreds of APIs across multiple categories. Find the perfect API for your project with our comprehensive search and filtering system.",
      image: "/slide1.png"
    },
    {
      title: "Test & Integrate",
      description: "Test APIs directly in our playground, view detailed documentation, and integrate seamlessly into your applications with code examples and guides.",
      image: "slide2.png"
    },
    {
      title: "Secure & Reliable",
      description: "Access secure APIs with proper authentication, CORS support, and HTTPS encryption. All APIs are verified and regularly updated for reliability.",
      image: "slide3.png"
    }
  ];

  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <header className="w-full px-8 py-4 border-b border-gray-100 sticky top-0 bg-white/80 backdrop-blur-md z-50">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 group cursor-pointer" onClick={() => router.push('/')}>
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center overflow-hidden border border-gray-100 group-hover:border-indigo-500 transition-colors">
              <img src="/APILogo.png" alt="API Store Logo" className="w-full h-full object-contain" />
            </div>
            <span className="text-2xl font-bold text-gray-900 tracking-tight">API Store</span>
          </div>
          <div className="flex items-center gap-4">
            {authLoading ? (
              <div className="w-8 h-8 rounded-full bg-gray-300 animate-pulse"></div>
            ) : user ? (
              <div className="flex items-center gap-3">
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setShowUserDropdown(!showUserDropdown)}
                    className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
                  >
                    {user.email?.charAt(0).toUpperCase() || 'U'}
                  </button>

                  {showUserDropdown && (
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                      <div className="px-4 py-2 border-b border-gray-200">
                        <p className="text-sm font-semibold text-gray-800">{user.email}</p>
                      </div>

                      <button
                        onClick={() => {
                          router.push('/profile');
                          setShowUserDropdown(false);
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-3"
                      >
                        <span className="text-purple-500">👤</span>
                        <span className="text-gray-700">Profile Dashboard</span>
                      </button>

                      <button
                        onClick={() => {
                          router.push('/cart');
                          setShowUserDropdown(false);
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-3"
                      >
                        <span className="text-blue-500">🛒</span>
                        <span className="text-gray-700">Cart</span>
                        {cart.length > 0 && (
                          <span className="ml-auto bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                            {cart.length}
                          </span>
                        )}
                      </button>

                      <div className="border-t border-gray-200 mt-2 pt-2">
                        <button
                          onClick={async () => {
                            try {
                              await fetch('/api/admin-session', { method: 'DELETE' });
                              await auth.signOut();
                              router.push('/');
                            } catch (error) {
                              console.error('Logout error:', error);
                            }
                          }}
                          className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-3 text-red-600"
                        >
                          <span>🚪</span>
                          <span>Logout</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                <button
                  onClick={() => router.push('/sign-in')}
                  className="px-4 py-2 rounded-lg border-2 border-blue-600 text-blue-600 font-semibold hover:bg-blue-50 transition-colors"
                >
                  Log In
                </button>
                <button
                  onClick={() => router.push('/sign-in')}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors"
                >
                  Create Account
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-[1440px] mx-auto px-8 py-10 md:py-16">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Left Side - Text Content */}
          <div className="space-y-6">
            <div className="inline-block px-3 py-1 rounded-full bg-orange-100 text-orange-600 text-sm font-semibold">
              API Store - Where APIs Meet Developers
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-gray-800 leading-tight">
              Develop, test, manage and consume APIs{' '}
              <span className="text-orange-500">securely and effortlessly.</span>
            </h1>
            <p className="text-xl text-gray-600 leading-relaxed">
              API Store empowers developers with everything they need to build, share, and integrate APIs, from sandbox testing to real-time analytics.
            </p>
            <div className="flex items-center gap-6 pt-4">
              <a
                href="#apis"
                className="text-lg font-semibold text-blue-600 hover:text-blue-700 border-b-2 border-blue-600 pb-1 transition-colors"
              >
                Explore →
              </a>
              <a
                href="#apis"
                className="text-lg font-semibold text-orange-500 hover:text-orange-600 border-b-2 border-orange-500 pb-1 transition-colors"
              >
                Get Started →
              </a>
            </div>
          </div>

          {/* Right Side - Illustration Placeholder */}
          <div className="relative">
            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-3xl p-6 shadow-2xl shadow-indigo-100 border border-indigo-100">
              <div className="aspect-[1.5/1] bg-white rounded-2xl flex items-center justify-center border-2 border-blue-500 relative overflow-hidden group">
                <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,#fff,rgba(255,255,255,0.6))] -z-10"></div>
                <div className="text-center transform group-hover:scale-105 transition-transform duration-500">
                  <div className="text-5xl mb-3 drop-shadow-sm">💻</div>
                  <div className="text-xl font-black text-gray-900 mb-1 tracking-tight">&lt;API STORE /&gt;</div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-4">Ready to contribute?</p>
                  <button
                    onClick={() => router.push('/submit-api')}
                    className="px-8 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-xs shadow-lg shadow-orange-200 transition-all hover:-translate-y-0.5"
                  >
                    SUBMIT API
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Cards Section */}
      <section className="max-w-[1440px] mx-auto px-8 py-12 bg-gray-50/50 rounded-3xl mx-4 mb-16">
        <div className="text-center mb-12">
          <div className="inline-block px-3 py-1 rounded-full bg-orange-100 text-orange-600 text-sm font-semibold mb-4">
            What Makes Us Reliable
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-800">
            Reliable APIs That Power Everyone , From Startups to Enterprises
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {featureCards.map((card, index) => (
            <div
              key={index}
              className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300 border border-gray-100"
            >
              <div className="aspect-video bg-gray-100 overflow-hidden">
                <img
                  src={card.image}
                  alt={card.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-6">
                <h3 className="text-2xl font-bold text-gray-800 mb-3">{card.title}</h3>
                <p className="text-gray-600 leading-relaxed">{card.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* APIs Section */}
      <section id="apis" className="max-w-[1440px] mx-auto px-8 py-16 bg-white">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
            Explore Our API Collection
          </h2>
          <p className="text-xl text-gray-600">
            Discover and integrate powerful APIs for your next project
          </p>
        </div>

        {/* Search and Filters */}
        <div className="mb-8 flex flex-col gap-6 items-center">
          <div className="w-full max-w-lg relative">
            <div className="relative">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search APIs... (Press Enter to add as filter)"
                className="w-full px-4 py-3 rounded-lg text-lg bg-gray-50 text-gray-800 placeholder-gray-500 border border-gray-300 outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                value={searchQuery}
                onChange={handleSearchChange}
                onKeyDown={handleSearchKeyDown}
                onFocus={() => searchQuery.trim() && suggestions.length > 0 && setShowSuggestions(true)}
              />

              {showSuggestions && (
                <div
                  ref={suggestionsRef}
                  className="absolute top-full left-0 right-0 mt-2 rounded-lg shadow-xl overflow-hidden z-50 bg-white border border-gray-200"
                  style={{
                    maxHeight: '400px',
                    overflowY: 'auto',
                  }}
                >
                  {suggestions.map((api) => (
                    <div
                      key={api.API}
                      className="px-4 py-3 cursor-pointer transition-colors border-b border-gray-200 hover:bg-gray-50"
                      onClick={() => handleSuggestionClick(api)}
                    >
                      <div className="font-semibold text-gray-800">
                        {api.API}
                      </div>
                      <div className="text-sm text-gray-600">
                        {api.Description.length > 80
                          ? api.Description.substring(0, 80) + '...'
                          : api.Description}
                      </div>
                      <div className="text-xs mt-1">
                        <span
                          className="inline-block px-2 py-0.5 rounded bg-blue-600 text-white"
                        >
                          {api.Category}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedTags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedTags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 bg-blue-600 text-white"
                    >
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:opacity-75 font-bold"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="w-full max-w-4xl">
            <div className="flex flex-wrap gap-2 justify-center">
              {displayedCategories.map((category) => (
                <button
                  key={category}
                  onClick={() => handleTagToggle(category)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${selectedTags.includes(category)
                    ? 'bg-blue-600 text-white border-2 border-blue-700'
                    : 'bg-gray-200 text-gray-700 border-2 border-transparent hover:bg-gray-300'
                    }`}
                >
                  {category}
                </button>
              ))}
              {categories.length > 9 && (
                <button
                  onClick={() => setShowAllCategories(!showAllCategories)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-gray-200 text-gray-700 border-2 border-transparent hover:bg-gray-300 transition-all"
                >
                  {showAllCategories ? 'Show Less' : '...'}
                </button>
              )}
            </div>
          </div>
          {!loading && (
            <div className="w-full text-center mt-4">
              <p className="text-lg font-semibold text-gray-700">
                {filteredApis.length} {filteredApis.length === 1 ? 'API' : 'APIs'} found
              </p>
            </div>
          )}
        </div>

        {/* API Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredApis.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-xl text-gray-600">
              No APIs found matching your filters. Try different search terms.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredApis.map((api) => {
              const isInWishlist = wishlist.includes(api.id!);
              const isInCart = cart.includes(api.id!);

              return (
                <div
                  key={api.API}
                  className="bg-white rounded-lg shadow-md p-6 h-full flex flex-col transition hover:shadow-xl border border-gray-200 relative group"
                >
                  {/* Wishlist + Cart Buttons */}
                  <div className="absolute top-4 right-4 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleWishlistToggle(api.id!);
                      }}
                      className={`p-2 rounded-full transition-colors ${isInWishlist
                        ? 'bg-red-500 text-white'
                        : 'bg-gray-200 text-gray-600 hover:bg-red-100 hover:text-red-500'
                        }`}
                      title={isInWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
                    >
                      <svg className="w-4 h-4" fill={isInWishlist ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (api.isPaid && !purchasedAPIs.includes(api.id!)) handleCartToggle(api.id!);
                      }}
                      className={`p-2 rounded-full transition-colors ${
                        api.isPaid && !purchasedAPIs.includes(api.id!)
                          ? isInCart
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-200 text-gray-600 hover:bg-blue-100 hover:text-blue-500'
                          : 'bg-gray-100 text-gray-300 cursor-default'
                      }`}
                      title={!api.isPaid ? 'Free API' : purchasedAPIs.includes(api.id!) ? 'Already purchased' : isInCart ? 'Remove from cart' : 'Add to cart'}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </button>
                  </div>

                  <div
                    onClick={() => onApiSelect(api.id!, api.API)}
                    className="flex-1 cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-lg font-semibold text-gray-800 pr-8">
                        {api.API}
                      </h3>
                      <div className="flex flex-col gap-1">
                        {user && api.userId === user.uid && (
                          <span className="px-2 py-1 bg-green-600 text-white text-xs rounded font-medium">
                            Owner
                          </span>
                        )}
                        {/* Pricing Badge */}
                        {!api.isPaid ? (
                          <span className="px-2 py-1 bg-green-500 text-white text-xs rounded font-medium">
                            FREE
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded font-medium">
                            ₹{(api.price).toFixed(2)}
                          </span>
                        )}
                        {/* Access Granted Badge */}
                        {api.isPaid && api.id && purchasedAPIs.includes(api.id) && (
                          <span className="px-2 py-1 bg-green-600 text-white text-xs rounded font-medium flex items-center gap-1">
                            ✓ Access Granted
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="mb-3 flex-grow text-sm text-gray-600">
                      {api.Description}
                    </p>

                    {/* Endpoint Display Logic */}
                    {(!api.isPaid || (user && api.userId === user.uid) || (api.id && purchasedAPIs.includes(api.id))) && (
                      <div className="mb-3 p-3 bg-gray-50 rounded border border-gray-200">
                        <p className="text-xs text-gray-600 mb-1">Endpoint:</p>
                        <code className="text-xs text-blue-600 break-all">{api.endpoint || api.Link}</code>
                      </div>
                    )}

                    {/* Purchase Button for Paid APIs */}
                    {api.isPaid && user && api.userId !== user.uid && api.id && !purchasedAPIs.includes(api.id) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/checkout?apiId=${api.id}`);
                        }}
                        className="w-full mb-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
                      >
                        Purchase Access – ₹{(api.price).toFixed(2)}
                      </button>
                    )}

                    {/* Sign in prompt for non-authenticated users */}
                    {api.isPaid && !user && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push('/sign-in');
                        }}
                        className="w-full mb-3 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg transition"
                      >
                        Sign in to Purchase
                      </button>
                    )}

                    <div className="flex flex-wrap gap-2 mt-2">
                      {[api.Auth, `CORS: ${api.Cors}`, api.HTTPS ? 'HTTPS' : 'HTTP'].filter(tag => tag).map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="mt-4 flex justify-between items-center">
                      <span
                        className="text-xs font-medium px-3 py-1 rounded bg-blue-600 text-white"
                      >
                        {api.Category}
                      </span>
                      <a
                        href={api.Link}
                        onClick={(e) => e.stopPropagation()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm hover:underline text-blue-600"
                      >
                        View Docs
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white/50 py-8">
        <div className="max-w-7xl mx-auto px-6 text-center text-gray-600">
          <p>&copy; 2026 API Store. Made with ❤️ by Team 3</p>
        </div>
      </footer>
    </main>
  );
}

// --- Page Components ---

function ApiDetailsPage({ apiId, onBackToHome }: { apiId: string; onBackToHome: () => void }) {
  const [apiDetails, setApiDetails] = useState<ApiDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [scrapingError, setScrapingError] = useState<string | null>(null);
  const [playgroundLoading, setPlaygroundLoading] = useState(false);
  const [playgroundResult, setPlaygroundResult] = useState<any>(null);
  const [playgroundError, setPlaygroundError] = useState<string | null>(null);

  useEffect(() => {
    if (!apiId) return;

    const fetchApiDetails = async () => {
      setLoading(true);
      setScrapingError(null);
      try {
        const db = getFirestore();
        let apiData: ApiEntry | undefined;
        let id: string | undefined;

        // 1. Try Direct ID Lookup
        try {
          const apiDoc = await getDoc(doc(db, 'apis', apiId));
          if (apiDoc.exists()) {
            apiData = apiDoc.data() as ApiEntry;
            id = apiDoc.id;
          }
        } catch (e) {
          // Ignore error, might be invalid ID format if it's a name
        }

        // 2. Fallback: Query by Name (if not found by ID)
        if (!apiData) {
          // Try to find by exact name match (API field)
          const q = query(collection(db, 'apis'), where('API', '==', apiId));
          const snapshot = await getDocs(q);

          if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            apiData = doc.data() as ApiEntry;
            id = doc.id;
          } else {
            // Try case-insensitive matching by fetching all (fallback for small datasets)
            // In production, use Algolia/Elasticsearch or a normalized 'slug' field
            const qAll = query(collection(db, 'apis'));
            const allSnapshot = await getDocs(qAll);
            const foundDoc = allSnapshot.docs.find(d => {
              const storedName = d.data().API as string;
              return (
                storedName.toLowerCase() === apiId.toLowerCase() ||
                slugify(storedName) === apiId.toLowerCase()
              );
            });
            if (foundDoc) {
              apiData = foundDoc.data() as ApiEntry;
              id = foundDoc.id;
            }
          }
        }

        if (apiData && id) {
          const api = { ...apiData, id };

          try {
            const docResponse = await fetch(`/api/scrape?url=${encodeURIComponent(api.Link)}`);
            const scrapedData: ScrapedData = await docResponse.json();

            if (scrapedData.error) {
              setScrapingError(scrapedData.error);
            }

            setApiDetails({ ...api, scraped: scrapedData });
          } catch (scrapeError) {
            console.error('Scraping failed:', scrapeError);
            setScrapingError('Unable to fetch additional details');
            setApiDetails({
              ...api,
              scraped: {
                overview: 'Unable to fetch documentation. Please visit the official link.',
                examples: [],
                requirements: [],
                isRestApi: false
              }
            });
          }
        } else {
          setApiDetails(null);
        }
      } catch (error) {
        console.error('Error fetching API details:', error);
        setApiDetails(null);
      } finally {
        setLoading(false);
      }
    };

    fetchApiDetails();
  }, [apiId]);

  const handlePlaygroundTest = async (password: string) => {
    setPlaygroundLoading(true);
    setPlaygroundError(null);
    setPlaygroundResult(null);

    try {
      const response = await fetch('/api/haveibeenpwned', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'API request failed');
      }

      setPlaygroundResult(data);
    } catch (error) {
      console.error('Playground test error:', error);
      setPlaygroundError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setPlaygroundLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!apiDetails) return <InfoMessage message="API not found" />;

  return (
    <main className="min-h-screen py-16 px-4 bg-white">
      <div className="max-w-4xl mx-auto">
        <div className="mb-10">
          <button
            onClick={onBackToHome}
            className="text-indigo-600 hover:text-indigo-700 font-semibold mb-8 flex items-center gap-2 group transition-all"
          >
            <span className="group-hover:-translate-x-1 transition-transform">←</span> Back to All APIs
          </button>
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
            <h1 className="text-5xl font-extrabold text-gray-900 tracking-tight">
              {apiDetails.API}
            </h1>
            <div className="flex flex-wrap gap-2">
              <span className="px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-100 text-indigo-700">{apiDetails.Category}</span>
              {apiDetails.isPaid && (
                <span className="px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-100 text-blue-700">₹{apiDetails.price}</span>
              )}
            </div>
          </div>

          <p className="text-xl text-gray-600 leading-relaxed mb-8 max-w-3xl">
            {apiDetails.Description}
          </p>

          <div className="flex flex-wrap gap-3">
            <div className="px-4 py-2 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center gap-2">
              <span className="text-gray-400 text-xs font-bold uppercase">Auth</span>
              <span className="text-gray-900 font-semibold text-sm">{apiDetails.Auth || 'None'}</span>
            </div>
            <div className="px-4 py-2 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center gap-2">
              <span className="text-gray-400 text-xs font-bold uppercase">CORS</span>
              <span className="text-gray-900 font-semibold text-sm">{apiDetails.Cors}</span>
            </div>
            {apiDetails.HTTPS && (
              <div className="px-4 py-2 rounded-xl bg-green-50 border border-green-100 shadow-sm flex items-center gap-2">
                <span className="text-green-600 text-xs font-bold uppercase">HTTPS</span>
                <span className="text-green-700 font-bold text-sm">Secure</span>
              </div>
            )}
          </div>
        </div>

        {scrapingError && (
          <div className="mb-8 p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 flex items-center gap-3">
            <span className="text-xl">⚠️</span>
            <p className="text-sm font-medium">{scrapingError}</p>
          </div>
        )}

        {/* Documentation Section */}
        <section className="mb-10">
          <h2 className="text-xl font-bold mb-5 text-gray-900 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-sm">📖</span>
            Documentation & Overview
          </h2>
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-300">
            <a 
              href={apiDetails.Link} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-bold text-lg mb-6 group transition-all"
            >
              Visit Official Documentation 
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </a>
            
            {apiDetails.scraped?.overview && (
              <div className="mt-2 text-gray-700">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">About this API</h3>
                <p className="leading-relaxed text-gray-600">{apiDetails.scraped.overview}</p>
              </div>
            )}
          </div>
        </section>

        {/* Examples Section */}
        {apiDetails.scraped?.examples && apiDetails.scraped.examples.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xl font-bold mb-5 text-gray-900 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center text-sm">💻</span>
              Implementation Examples
            </h2>
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-300">
              {apiDetails.scraped.examples.map((example, index) => (
                <div key={index} className="relative group mb-4 last:mb-0">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Example {index + 1}</span>
                    <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-1 rounded font-bold">REST / BASH</span>
                  </div>
                  <pre className="p-5 rounded-xl bg-slate-50 border border-slate-200 overflow-x-auto text-sm text-gray-700 font-mono leading-relaxed">
                    <code>{example}</code>
                  </pre>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Requirements Section */}
        {apiDetails.scraped?.requirements && apiDetails.scraped.requirements.length > 0 && (
          <section className="mb-12">
            <h2 className="text-xl font-bold mb-5 text-gray-900 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-sm">✨</span>
              Features & Requirements
            </h2>
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-300">
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {apiDetails.scraped.requirements.map((req, index) => (
                  <li key={index} className="flex items-start gap-3 text-gray-600">
                    <span className="text-emerald-500 mt-1">✓</span>
                    <span className="text-sm font-medium">{req}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* Playground Section */}
        {apiDetails.API === 'HaveIBeenPwned' && (
          <section className="mb-12">
            <h2 className="text-xl font-bold mb-5 text-gray-900 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-sm">🛡️</span>
              Playground
            </h2>
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-300">
              <p className="text-gray-600 mb-8 max-w-xl text-sm font-medium">
                Test password vulnerabilities instantly. We only use partial SHA-1 k-Anonymity for total privacy.
              </p>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 max-w-lg">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                  Password to check
                </label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="password"
                    id="passwordInput"
                    className="flex-1 px-4 py-3 rounded-xl bg-white border border-slate-300 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                    placeholder="e.g. hunter2"
                  />
                  <button
                    onClick={() => {
                      const passwordInput = document.getElementById('passwordInput') as HTMLInputElement;
                      if (passwordInput.value.trim()) {
                        handlePlaygroundTest(passwordInput.value.trim());
                      }
                    }}
                    disabled={playgroundLoading}
                    className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-200"
                  >
                    {playgroundLoading ? 'Testing...' : 'Check Now'}
                  </button>
                </div>

                {playgroundError && (
                  <div className="mt-4 p-4 rounded-xl bg-red-50 text-red-700 text-sm font-medium border border-red-100">
                    ❌ {playgroundError}
                  </div>
                )}

                {playgroundResult && (
                  <div className={`mt-6 p-6 rounded-2xl border ${
                    playgroundResult.status === 'safe' 
                      ? 'bg-green-50 border-green-100 text-green-800' 
                      : 'bg-orange-50 border-orange-100 text-orange-800'
                  }`}>
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-2xl">
                        {playgroundResult.status === 'safe' ? '✅' : '⚠️'}
                      </span>
                      <div className="font-bold text-lg leading-none">
                        {playgroundResult.status === 'safe' ? 'Safe to use' : 'Compromised'}
                      </div>
                    </div>
                    <p className="text-sm opacity-90 leading-relaxed mb-3">{playgroundResult.message}</p>
                    {playgroundResult.breachCount && (
                      <div className="inline-block px-3 py-1 rounded-full bg-orange-200/50 text-orange-900 text-[10px] font-black uppercase">
                        Found in {playgroundResult.breachCount} data leaks
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>
          )}
        </div>
      </main>
  );
}

function PageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const apiId = searchParams.get('apiId');
  const apiName = searchParams.get('api');

  const handleApiSelect = (selectedApiId: string, name?: string) => {
    const params = new URLSearchParams(window.location.search);
    if (name) {
      params.set('api', slugify(name));
      params.delete('apiId');
    } else {
      params.set('apiId', selectedApiId);
    }
    router.push(`/?${params.toString()}`);
    window.scrollTo(0, 0);
  };

  const handleBackToHome = () => {
    router.push('/');
    window.scrollTo(0, 0);
  };

  const lookupKey = apiId || apiName;

  if (lookupKey) {
    return (
      <>
        <ApiDetailsPage apiId={lookupKey} onBackToHome={handleBackToHome} />
        <Chatbot />
      </>
    );
  }

  return (
    <>
      <LandingPage onApiSelect={handleApiSelect} />
      <Chatbot />
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-white"><div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>}>
      <PageInner />
    </Suspense>
  );
}