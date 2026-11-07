'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'motion/react';
import { useAuth, dashPath } from '@/components/providers/AuthProvider';
import { Role } from '@/lib/types';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuthOpen } = useAuth();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [roleDest, setRoleDest] = useState<Role>('patient');

  useEffect(() => {
    const token = searchParams.get('token');
    const role = searchParams.get('role') as Role;
    const name = searchParams.get('name');

    if (!token || !role) {
      setStatus('error');
      setTimeout(() => router.push('/'), 3000);
      return;
    }

    setRoleDest(role);
    setStatus('success');
    
    if (typeof window !== 'undefined') {
      const authUser = {
        id: token,
        fullName: name || 'Aurelis Member',
        accountName: name || 'member',
        email: '',
        role: role,
      };
      const session = {
        token: token,
        user: authUser,
      };
      localStorage.setItem('aurelis.session.v1', JSON.stringify(session));
      localStorage.setItem('aurelis_token', token);
      localStorage.setItem('aurelis_role', role);
      if (name) localStorage.setItem('aurelis_name', name);
    }
    setAuthOpen(false);

    // Wait for animation then redirect
    setTimeout(() => {
      window.location.href = dashPath(role);
    }, 2500);
  }, [searchParams, router, setAuthOpen]);

  return (
    <div className="min-h-screen bg-[#050B08] flex items-center justify-center font-sans overflow-hidden">
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center text-center p-8 relative"
      >
        {status === 'processing' && (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
            className="w-16 h-16 border-4 border-[#C8B08F]/20 border-t-[#C8B08F] rounded-full mb-6"
          />
        )}
        
        {status === 'success' && (
          <div className="relative mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.2, 1] }}
              transition={{ duration: 0.6, times: [0, 0.6, 1], ease: 'circOut' }}
              className="w-24 h-24 bg-gradient-to-tr from-[#9B8766] to-[#C8B08F] rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(200,176,143,0.3)]"
            >
              <motion.svg
                viewBox="0 0 50 50"
                className="w-12 h-12 text-[#050B08]"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.5, delay: 0.3, ease: 'easeOut' }}
              >
                <motion.path d="M14.1 27.2l7.1 7.2 16.7-16.8" />
              </motion.svg>
            </motion.div>
            
            {/* 3D Ring Effect */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8, rotateX: 60 }}
              animate={{ opacity: [0, 1, 0], scale: 1.8, rotateX: 60 }}
              transition={{ duration: 1.5, delay: 0.1, ease: 'easeOut' }}
              className="absolute top-0 left-0 w-full h-full border border-[#C8B08F] rounded-full"
            />
          </div>
        )}

        {status === 'error' && (
          <div className="w-24 h-24 bg-red-900/30 border border-red-500 rounded-full flex items-center justify-center mb-8 text-red-500 text-3xl">
            !
          </div>
        )}

        <motion.h1 
          className="text-3xl font-serif text-[#F4F0EA] mb-3 tracking-wide"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {status === 'processing' ? 'Authenticating...' : 
           status === 'success' ? 'Sign in successful' : 'Authentication failed'}
        </motion.h1>

        <motion.p 
          className="text-[#9CA3AF] max-w-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          {status === 'processing' ? 'Securely verifying your credentials.' : 
           status === 'success' ? `Redirecting to your ${roleDest} dashboard...` : 'Returning to home page...'}
        </motion.p>
      </motion.div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#050B08] flex items-center justify-center font-sans">
        <div className="w-16 h-16 border-4 border-[#C8B08F]/20 border-t-[#C8B08F] rounded-full animate-spin" />
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}
