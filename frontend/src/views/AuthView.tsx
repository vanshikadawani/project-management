import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { Shield, Lock, UserPlus, LogIn, AlertCircle, Building2, UserCheck } from 'lucide-react';

export const AuthView: React.FC = () => {
  const { directory, login, signup } = useAuth();
  const [tab, setTab] = useState<'login' | 'signup'>('login');

  // Login form state
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [loginEmail, setLoginEmail] = useState<string>('');
  const [loginMode, setLoginMode] = useState<'select' | 'email'>('select');

  // Sign up form state
  const [signupName, setSignupName] = useState<string>('');
  const [signupEmail, setSignupEmail] = useState<string>('');
  const [signupDept, setSignupDept] = useState<string>('Operations');
  const [signupRole, setSignupRole] = useState<'Employee' | 'ProjectOwner'>('Employee');

  const [loading, setLoading] = useState<boolean>(false);
  const submittingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || loading) return;
    submittingRef.current = true;
    setError(null);
    setLoading(true);

    try {
      const credentials =
        loginMode === 'select'
          ? { userId: selectedUserId || (directory[0]?.id ?? '') }
          : { email: loginEmail.trim() };

      const res = await login(credentials);
      if (!res.success) {
        setError(res.error || 'Invalid credentials');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || loading) return;
    setError(null);

    if (!signupName.trim() || !signupEmail.trim()) {
      setError('Please fill in all required fields.');
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    try {
      const res = await signup({
        name: signupName.trim(),
        email: signupEmail.trim(),
        department: signupDept.trim(),
        role: signupRole,
      });

      if (!res.success) {
        setError(res.error || 'Account creation failed');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBF9F4] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-2">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-[#C85A32] flex items-center justify-center text-white shadow-md">
          <span className="font-serif font-bold text-2xl leading-none">F</span>
        </div>
        <h2 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-[#231E1B]">
          Fern &amp; Foley — Projects
        </h2>
        <p className="text-xs text-[#70685F]">
          Mobile-First Project Operations &amp; Execution System
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 sm:px-10 rounded-3xl border border-[#E8E2D5] shadow-lg space-y-6">
          {/* Tab Selection */}
          <div className="flex rounded-2xl bg-[#F5F1E8] p-1 border border-[#E0D9CB]">
            <button
              id="auth-tab-login"
              type="button"
              onClick={() => {
                setTab('login');
                setError(null);
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                tab === 'login'
                  ? 'bg-white text-[#231E1B] shadow-xs'
                  : 'text-[#70685F] hover:text-[#231E1B]'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              Sign In
            </button>
            <button
              id="auth-tab-signup"
              type="button"
              onClick={() => {
                setTab('signup');
                setError(null);
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                tab === 'signup'
                  ? 'bg-white text-[#231E1B] shadow-xs'
                  : 'text-[#70685F] hover:text-[#231E1B]'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              Create Account
            </button>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3 rounded-xl bg-[#FEE2E2] border border-[#FECACA] text-xs text-[#991B1B] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* LOGIN FORM */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="flex items-center justify-between text-[11px] text-[#70685F]">
                <span>Choose sign in method:</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setLoginMode('select')}
                    className={`font-semibold cursor-pointer ${
                      loginMode === 'select' ? 'text-[#C85A32] underline' : 'hover:text-[#231E1B]'
                    }`}
                  >
                    Directory
                  </button>
                  <span>·</span>
                  <button
                    type="button"
                    onClick={() => setLoginMode('email')}
                    className={`font-semibold cursor-pointer ${
                      loginMode === 'email' ? 'text-[#C85A32] underline' : 'hover:text-[#231E1B]'
                    }`}
                  >
                    Email Address
                  </button>
                </div>
              </div>

              {loginMode === 'select' ? (
                <div>
                  <label className="block text-xs font-semibold text-[#231E1B] mb-1">
                    Select Account
                  </label>
                  <select
                    id="login-select-user"
                    value={selectedUserId || (directory[0]?.id ?? '')}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#DDD6C8] bg-white text-xs text-[#231E1B] focus:outline-hidden focus:border-[#C85A32] min-h-[44px]"
                  >
                    {directory.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} ({user.role === 'ProjectOwner' ? 'Owner' : user.role}) — {user.email}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-[#231E1B] mb-1">
                    Work Email Address
                  </label>
                  <input
                    id="login-email-input"
                    type="email"
                    required
                    placeholder="e.g. sarah.chen@fernandfoley.internal"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#DDD6C8] bg-white text-xs text-[#231E1B] placeholder-[#8F867A] focus:outline-hidden focus:border-[#C85A32] min-h-[44px]"
                  />
                </div>
              )}

              <button
                id="login-submit-btn"
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl bg-[#C85A32] hover:bg-[#A63C1E] text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer min-h-[44px] disabled:opacity-50"
              >
                <LogIn className="w-4 h-4" />
                {loading ? 'Authenticating...' : 'Sign In to Workspace'}
              </button>
            </form>
          )}

          {/* SIGN UP FORM */}
          {tab === 'signup' && (
            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#231E1B] mb-1">
                  Full Name <span className="text-[#C85A32]">*</span>
                </label>
                <input
                  id="signup-name-input"
                  type="text"
                  required
                  placeholder="e.g. Alex Morgan"
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DDD6C8] bg-white text-xs text-[#231E1B] placeholder-[#8F867A] focus:outline-hidden focus:border-[#C85A32] min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#231E1B] mb-1">
                  Email Address <span className="text-[#C85A32]">*</span>
                </label>
                <input
                  id="signup-email-input"
                  type="email"
                  required
                  placeholder="e.g. alex.morgan@fernandfoley.internal"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DDD6C8] bg-white text-xs text-[#231E1B] placeholder-[#8F867A] focus:outline-hidden focus:border-[#C85A32] min-h-[44px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#231E1B] mb-1">
                    Department
                  </label>
                  <input
                    id="signup-dept-input"
                    type="text"
                    placeholder="e.g. Site Engineering"
                    value={signupDept}
                    onChange={(e) => setSignupDept(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#DDD6C8] bg-white text-xs text-[#231E1B] placeholder-[#8F867A] focus:outline-hidden focus:border-[#C85A32] min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#231E1B] mb-1">
                    Requested Role
                  </label>
                  <select
                    id="signup-role-select"
                    value={signupRole}
                    onChange={(e) => setSignupRole(e.target.value as any)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#DDD6C8] bg-white text-xs text-[#231E1B] focus:outline-hidden focus:border-[#C85A32] min-h-[44px]"
                  >
                    <option value="Employee">Employee</option>
                    <option value="ProjectOwner">Project Owner</option>
                  </select>
                </div>
              </div>

              <div className="text-[11px] text-[#7A7165] bg-[#FAF7F0] p-2.5 rounded-xl border border-[#EDE7DC]">
                <strong>Role Notice:</strong> CEO role is strictly restricted to executive governance and cannot be selected on sign-up.
              </div>

              <button
                id="signup-submit-btn"
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl bg-[#526E55] hover:bg-[#3E5540] text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer min-h-[44px] disabled:opacity-50"
              >
                <UserPlus className="w-4 h-4" />
                {loading ? 'Creating Account...' : 'Create Account & Sign In'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
