'use client';
import { useState } from 'react';
export default function LoginPage() {
  const [username,setUsername]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(false);
  async function submit(event:React.FormEvent) {
    event.preventDefault();setLoading(true);setError('');
    try {
      const response=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password,returnTo:new URLSearchParams(window.location.search).get('return_to')||'/'})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||'Đăng nhập thất bại.');
      window.location.assign(data.returnTo);
    } catch(e) {setError(e instanceof Error?e.message:'Đăng nhập thất bại.');setLoading(false)}
  }
  return <main className="login-page"><form className="login-card" onSubmit={submit}><div className="brand-mark">L</div><h1>CRM Labcos</h1><p>Đăng nhập để xem dữ liệu Marketing và Sale.</p><label>Tài khoản<input required value={username} onChange={e=>setUsername(e.target.value)} autoComplete="username"/></label><label>Mật khẩu<input required type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password"/></label>{error&&<p className="form-error" role="alert">{error}</p>}<button className="button primary" disabled={loading}>{loading?'Đang đăng nhập…':'Đăng nhập'}</button></form></main>;
}
