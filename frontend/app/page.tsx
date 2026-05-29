"use client";

import { useEffect, useState, useRef } from "react";
import { Show, SignInButton, UserButton, useAuth } from "@clerk/nextjs";

type Bookmark = {
  id: number;
  title: string;
  url: string;
  summary: string;
  category: string;
  created_at: string;
};

function timeAgo(dateStr: string): string {
  if (!dateStr) return "";
  
  // If the ISO date string has no timezone suffix, force it to be treated as UTC
  let formattedStr = dateStr;
  if (!dateStr.endsWith("Z") && !dateStr.includes("+") && !/-\d{2}:\d{2}$/.test(dateStr)) {
    formattedStr = `${dateStr}Z`;
  }

  const now = Date.now();
  const then = new Date(formattedStr).getTime();
  const diff = Math.max(0, now - then);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

const VALID_CATEGORIES = [
  "Backend", "Frontend", "AI/ML", "DevOps", "Database",
  "Mobile", "Security", "Cloud", "Productivity", "Programming", "Other",
];

const CATEGORY_COLORS: Record<string, string> = {
  "Backend":     "#3b82f6",
  "Frontend":    "#f43f5e",
  "AI/ML":       "#8b5cf6",
  "DevOps":      "#f59e0b",
  "Database":    "#10b981",
  "Mobile":      "#ec4899",
  "Security":    "#ef4444",
  "Cloud":       "#06b6d4",
  "Productivity":"#84cc16",
  "Programming": "#a78bfa",
  "Other":       "#6b7280",
};

function getCategoryColor(cat: string) {
  return CATEGORY_COLORS[cat] || "#6b7280";
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function Home() {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [activeCategory, setActiveCategory] = useState("All");
  // null = "Auto (AI)" — let backend Gemini decide
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  const { getToken } = useAuth();
  
  const [isMobile, setIsMobile] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    function checkRes() {
      setIsMobile(window.innerWidth <= 768);
    }
    checkRes();
    window.addEventListener("resize", checkRes);
    return () => window.removeEventListener("resize", checkRes);
  }, []);
  
  // ── Swipe-to-refresh Touch Gesture Hooks ─────────────────────────────────
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [pullOffset, setPullOffset] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  function handleTouchStart(e: React.TouchEvent) {
    if (window.scrollY === 0 && !isRefreshing) {
      setTouchStart(e.touches[0].clientY);
    }
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (touchStart === null || isRefreshing) return;
    const rawDistance = e.touches[0].clientY - touchStart;
    if (rawDistance > 0) {
      // Damped pull math to make the pull feel premium and resistive
      const pull = Math.min(80, Math.pow(rawDistance, 0.85));
      setPullOffset(pull);
      // Prevent browser default pull-to-refresh if we are handling it
      if (e.cancelable) e.preventDefault();
    }
  }

  async function handleTouchEnd() {
    if (touchStart === null || isRefreshing) return;
    setTouchStart(null);

    if (pullOffset >= 55) {
      setIsRefreshing(true);
      setPullOffset(55); // Hold indicator at nice spinning offset
      try {
        await fetchBookmarks();
      } catch {
        // silently catch
      } finally {
        // Smoothly animate retraction
        setTimeout(() => {
          setIsRefreshing(false);
          setPullOffset(0);
        }, 600);
      }
    } else {
      setPullOffset(0);
    }
  }

  async function fetchBookmarks() {
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/bookmarks`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setBookmarks(data);
      } else {
        setBookmarks([]);
      }
    } catch {
      setBookmarks([]);
    }
  }

  async function searchBookmarks(query: string) {
    if (!query.trim()) { fetchBookmarks(); return; }
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/search?q=${query}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setBookmarks(data);
      } else {
        setBookmarks([]);
      }
    } catch {
      setBookmarks([]);
    }
  }

  async function addBookmark() {
    if (!title.trim() || !url.trim()) { setError("Please enter both title and URL."); return; }
    try { new URL(url); } catch { setError("Please enter a valid URL (e.g. https://example.com)."); return; }
    setError("");
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/bookmarks`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify({ title, url, category: selectedCategory }),
      });
      
      if (!res.ok) {
        if (res.status === 502 || res.status === 503 || res.status === 504) {
          throw new Error("waking_up");
        }
        throw new Error("failed");
      }
      
      setTitle(""); setUrl("");
      setIsDialogOpen(false);
      fetchBookmarks();
    } catch (err: any) {
      if (err?.message === "waking_up") {
        setError("The server is waking up (Render free tier cold start). Please wait a few seconds and try again.");
      } else {
        setError("Could not connect to the server. If the backend is sleeping, it may take up to a minute to wake up. Please try again shortly.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function updateBookmark() {
    if (!title.trim() || !url.trim()) { setError("Please enter both title and URL."); return; }
    try { new URL(url); } catch { setError("Please enter a valid URL (e.g. https://example.com)."); return; }
    setError("");
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/bookmarks/${editingId}`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ title, url, category: selectedCategory }),
      });
      
      if (!res.ok) {
        if (res.status === 502 || res.status === 503 || res.status === 504) {
          throw new Error("waking_up");
        }
        throw new Error("failed");
      }
      
      setTitle(""); setUrl(""); setEditingId(null);
      setIsDialogOpen(false);
      fetchBookmarks();
    } catch (err: any) {
      if (err?.message === "waking_up") {
        setError("The server is waking up (Render free tier cold start). Please wait a few seconds and try again.");
      } else {
        setError("Could not connect to the server. If the backend is sleeping, it may take up to a minute to wake up. Please try again shortly.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function confirmDelete() {
    if (deleteTargetId === null) return;
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/bookmarks/${deleteTargetId}`, { 
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error();
      setDeleteTargetId(null);
      fetchBookmarks();
    } catch {
      setDeleteTargetId(null);
      setError("Delete failed. The server might be waking up; please try again shortly.");
    }
  }

  function openEdit(bookmark: Bookmark) {
    setTitle(bookmark.title);
    setUrl(bookmark.url);
    setEditingId(bookmark.id);
    // Pre-select the current category so the user can see and optionally change it
    setSelectedCategory(bookmark.category || null);
    setError("");
    setIsDialogOpen(true);
  }

  function closeDialog() {
    setIsDialogOpen(false);
    setEditingId(null);
    setTitle(""); setUrl(""); setError("");
    setSelectedCategory(null);
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => { fetchBookmarks(); }, []);

  // Debounce search — wait 300ms after the user stops typing before hitting the backend
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      searchBookmarks(searchQuery);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  // Close dialog on ESC key
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") closeDialog(); }
    if (isDialogOpen) { window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }
  }, [isDialogOpen]);

  const safeBookmarks = Array.isArray(bookmarks) ? bookmarks : [];

  const categories = ["All", ...Array.from(new Set(safeBookmarks.map(b => b.category).filter(Boolean)))];

  const visible = safeBookmarks.filter(b =>
    (activeCategory === "All" || b.category === activeCategory)
  );

  // ─── Styles ────────────────────────────────────────────────────────────────

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "11px 14px",
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: "12px", color: "var(--text)", fontSize: "14px",
    outline: "none", fontFamily: "inherit", transition: "border-color 0.2s",
  };

  const btnSecondary: React.CSSProperties = {
    padding: "10px 20px", background: "var(--surface)",
    border: "1px solid var(--border)", borderRadius: "12px",
    color: "var(--text-secondary)", fontSize: "14px", fontWeight: 500,
    cursor: "pointer", fontFamily: "inherit", transition: "background 0.15s",
  };

  const btnPrimary: React.CSSProperties = {
    padding: "10px 24px",
    background: "linear-gradient(135deg, #8b5cf6, #6366f1)",
    border: "none", borderRadius: "12px", color: "white",
    fontSize: "14px", fontWeight: 600, cursor: "pointer",
    fontFamily: "inherit", display: "flex", alignItems: "center", gap: "8px",
    transition: "opacity 0.2s",
  };

  const iconBtn: React.CSSProperties = {
    width: "30px", height: "30px", background: "var(--surface)",
    border: "1px solid var(--border)", borderRadius: "8px",
    color: "var(--text-muted)", display: "flex", alignItems: "center",
    justifyContent: "center", cursor: "pointer", transition: "background 0.15s, color 0.15s, border-color 0.15s",
  };

  const overlayStyle: React.CSSProperties = {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)",
    backdropFilter: "blur(6px)", zIndex: 100,
    display: "flex", alignItems: "center", justifyContent: "center",
    animation: "overlayFadeIn 0.2s ease",
  };

  const dialogStyle: React.CSSProperties = {
    background: "#111118", border: "1px solid rgba(139,92,246,0.25)",
    borderRadius: "20px", padding: isMobile ? "20px" : "32px", width: "90%", maxWidth: "460px",
    boxShadow: "0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(139,92,246,0.08)",
    animation: "dialogSlideIn 0.25s ease",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "11px", fontWeight: 600, color: "var(--text-muted)",
    display: "block", marginBottom: "6px", letterSpacing: "0.06em",
  };

  return (
    <>
      {/* ══════════════════════════════ LOGIN SCREEN ══════════════════════════ */}
      <Show when="signed-out">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "var(--bg)" }}>
          <div style={{ textAlign: "center", background: "var(--surface)", padding: "48px", borderRadius: "20px", border: "1px solid var(--border)", boxShadow: "0 24px 64px rgba(0,0,0,0.3)" }}>
            <div style={{
              width: "56px", height: "56px", margin: "0 auto 20px",
              background: "linear-gradient(135deg, #8b5cf6, #6366f1)",
              borderRadius: "14px", display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <h1 style={{ fontSize: "28px", fontWeight: "bold", color: "var(--text)", marginBottom: "12px", letterSpacing: "-0.5px" }}>AI Bookmark Vault</h1>
            <p style={{ color: "var(--text-muted)", marginBottom: "32px", fontSize: "15px" }}>Sign in to manage your private bookmarks.</p>
            <SignInButton mode="modal">
              <button style={{...btnPrimary, margin: "0 auto", padding: "12px 32px", fontSize: "15px"}}>
                Sign In to Vault
              </button>
            </SignInButton>
          </div>
        </div>
      </Show>

      {/* ══════════════════════════════ APP SHELL ═════════════════════════════ */}
      <Show when="signed-in">
        <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>

          {/* Mobile sidebar overlay back-drop */}
          {isMobile && isSidebarOpen && (
            <div 
              onClick={() => setIsSidebarOpen(false)}
              style={{
                position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
                backdropFilter: "blur(4px)", zIndex: 99,
              }}
            />
          )}

          {/* ══════════════════════════════ SIDEBAR ══════════════════════════════ */}
          <aside style={{
            width: "260px", minHeight: "100vh",
            background: "var(--sidebar-bg)", borderRight: "1px solid var(--border)",
            display: "flex", flexDirection: "column",
            position: "fixed", top: 0, 
            left: isMobile ? (isSidebarOpen ? 0 : "-260px") : 0, 
            bottom: 0, zIndex: 100,
            transition: "left 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
          }}>

            {/* Logo and User Profile */}
            <div style={{ padding: "28px 24px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{
                    width: "36px", height: "36px",
                    background: "linear-gradient(135deg, #8b5cf6, #6366f1)",
                    borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--text)", letterSpacing: "-0.3px" }}>AI Bookmark Vault</div>
                  </div>
                </div>
                {/* Clerk User Button */}
                <UserButton appearance={{ elements: { userButtonAvatarBox: { width: "32px", height: "32px" } } }} />
              </div>
            </div>

        {/* Add button */}
        <div style={{ padding: "0 16px 20px" }}>
          <button
            onClick={() => { setEditingId(null); setTitle(""); setUrl(""); setError(""); setIsDialogOpen(true); }}
            style={{
              width: "100%", padding: "10px 16px",
              background: "linear-gradient(135deg, #8b5cf6, #6366f1)",
              border: "none", borderRadius: "12px", color: "white",
              fontSize: "14px", fontWeight: 600, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              transition: "opacity 0.2s, transform 0.2s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.88"; (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)"; }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Bookmark
          </button>
        </div>

        <div style={{ height: "1px", background: "var(--border)", margin: "0 16px 16px" }} />

        {/* Categories */}
        <div style={{ padding: "0 12px", flex: 1, overflowY: "auto" }}>
          <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.1em", textTransform: "uppercase", padding: "0 8px 10px" }}>
            Categories
          </div>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => { setActiveCategory(cat); if (isMobile) setIsSidebarOpen(false); }}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: "10px",
                padding: "9px 12px", borderRadius: "10px", border: "none",
                background: activeCategory === cat ? "rgba(139,92,246,0.12)" : "transparent",
                color: activeCategory === cat ? "#8b5cf6" : "var(--text-secondary)",
                fontSize: "13.5px", fontWeight: activeCategory === cat ? 600 : 400,
                cursor: "pointer", textAlign: "left",
                transition: "background 0.15s, color 0.15s", marginBottom: "2px",
              }}
            >
              <span style={{
                width: "8px", height: "8px", borderRadius: "50%", flexShrink: 0,
                background: cat === "All" ? "linear-gradient(135deg, #8b5cf6, #6366f1)" : getCategoryColor(cat),
              }} />
              {cat}
              <span style={{
                marginLeft: "auto", fontSize: "11px", padding: "1px 8px", borderRadius: "20px",
                background: activeCategory === cat ? "rgba(139,92,246,0.18)" : "rgba(255,255,255,0.05)",
                color: activeCategory === cat ? "#a78bfa" : "var(--text-muted)", fontWeight: 500,
              }}>
                {cat === "All" ? safeBookmarks.length : safeBookmarks.filter(b => b.category === cat).length}
              </span>
            </button>
          ))}
        </div>

        {/* Stats footer */}
        <div style={{ padding: "16px", borderTop: "1px solid var(--border)" }}>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "8px", fontWeight: 600, letterSpacing: "0.05em" }}>VAULT STATS</div>
          <div style={{ display: "flex", gap: "8px" }}>
            <div style={{ flex: 1, background: "var(--surface)", borderRadius: "10px", padding: "10px", textAlign: "center" }}>
              <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--text)" }}>{safeBookmarks.length}</div>
              <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "2px", fontWeight: 500 }}>Saved</div>
            </div>
            <div style={{ flex: 1, background: "var(--surface)", borderRadius: "10px", padding: "10px", textAlign: "center" }}>
              <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--text)" }}>{categories.length - 1}</div>
              <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "2px", fontWeight: 500 }}>Topics</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ══════════════════════════════ MAIN ══════════════════════════════════ */}
      <main 
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ 
          marginLeft: isMobile ? 0 : "260px", 
          flex: 1, 
          display: "flex", 
          flexDirection: "column", 
          minHeight: "100vh",
          position: "relative",
          width: isMobile ? "100%" : "calc(100% - 260px)"
        }}
      >
        {/* Swipe-to-refresh premium visual spinner */}
        <div style={{
          position: "absolute",
          top: `${pullOffset - 40}px`,
          left: "50%",
          transform: "translateX(-50%)",
          width: "36px",
          height: "36px",
          borderRadius: "50%",
          background: "#161622",
          border: "1px solid rgba(139, 92, 246, 0.3)",
          boxShadow: "0 4px 16px rgba(0,0,0,0.5), 0 0 12px rgba(139, 92, 246, 0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 99,
          opacity: pullOffset > 10 ? Math.min(1, (pullOffset - 10) / 30) : 0,
          transition: isRefreshing ? "top 0.15s ease" : "none",
          pointerEvents: "none",
        }}>
          <svg 
            width="18" 
            height="18" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="#8b5cf6" 
            strokeWidth="3" 
            strokeLinecap="round" 
            style={{
              transform: `rotate(${pullOffset * 6}deg)`,
              animation: isRefreshing ? "spin 0.8s linear infinite" : "none",
              transition: isRefreshing ? "none" : "transform 0.05s linear",
            }}
          >
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
          </svg>
        </div>

        {/* Sticky top bar */}
        <div style={{
          position: "sticky", top: 0, zIndex: 9,
          background: "rgba(7,7,10,0.85)", backdropFilter: "blur(14px)",
          borderBottom: "1px solid var(--border)",
          padding: isMobile ? "10px 16px" : "14px 32px", 
          display: "flex", alignItems: "center", gap: "10px",
        }}>
          {isMobile && (
            <button 
              onClick={() => setIsSidebarOpen(true)}
              style={{
                background: "none", border: "none", color: "var(--text)", 
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                padding: "6px", marginRight: "4px"
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          )}
          <div style={{ position: "relative", flex: 1, maxWidth: "460px" }}>
            <svg style={{ position: "absolute", left: "13px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }}
              width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              placeholder="Search bookmarks..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ ...inputStyle, paddingLeft: "40px", padding: "10px 14px 10px 40px" }}
              onFocus={e => e.target.style.borderColor = "var(--accent)"}
              onBlur={e => e.target.style.borderColor = "var(--border)"}
            />
          </div>
          {/*<div style={{ marginLeft: "auto", fontSize: "13px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
            {visible.length} bookmark{visible.length !== 1 ? "s" : ""}
          </div>*/}
        </div>

        {/* Page content */}
        <div style={{ padding: isMobile ? "16px" : "32px", flex: 1 }}>

          {/* Heading */}
          <div style={{ marginBottom: "24px" }}>
            <h1 style={{ fontSize: "22px", fontWeight: 700, color: "var(--text)", letterSpacing: "-0.4px" }}>
              {activeCategory === "All" ? "All Bookmarks" : activeCategory}
            </h1>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "4px" }}>
              {searchQuery
                ? `Showing results for "${searchQuery}"`
                : `${visible.length} bookmark${visible.length !== 1 ? "s" : ""} saved`}
            </p>
          </div>

          {/* Empty state */}
          {visible.length === 0 && (
            <div style={{ textAlign: "center", paddingTop: "80px", color: "var(--text-muted)" }}>
              <div style={{
                width: "72px", height: "72px", background: "var(--surface)",
                borderRadius: "20px", display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 20px",
              }}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <p style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "8px" }}>
                {searchQuery ? `No results for "${searchQuery}"` : "No bookmarks yet"}
              </p>
              <p style={{ fontSize: "13px" }}>
                {searchQuery ? "Try a different search term" : "Click 'Add Bookmark' to save your first link"}
              </p>
            </div>
          )}

          {/* Bookmark grid */}
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(340px, 1fr))", 
            gap: "16px" 
          }}>
            {visible.map((bookmark, index) => (
              <div
                key={bookmark.id}
                style={{
                  background: "rgba(255,255,255,0.025)", border: "1px solid var(--border)",
                  borderRadius: "16px", padding: "20px",
                  transition: "transform 0.2s, border-color 0.2s, box-shadow 0.2s",
                  animation: "fadeInUp 0.4s ease both",
                  animationDelay: `${index * 0.05}s`,
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.transform = "translateY(-3px)";
                  el.style.borderColor = "rgba(139,92,246,0.3)";
                  el.style.boxShadow = "0 10px 36px rgba(139,92,246,0.1)";
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.transform = "translateY(0)";
                  el.style.borderColor = "var(--border)";
                  el.style.boxShadow = "none";
                }}
              >
                {/* Card header row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                  <span style={{
                    fontSize: "11px", fontWeight: 600, padding: "3px 10px", borderRadius: "20px",
                    background: `${getCategoryColor(bookmark.category)}1a`,
                    color: getCategoryColor(bookmark.category),
                    border: `1px solid ${getCategoryColor(bookmark.category)}33`,
                    letterSpacing: "0.03em",
                  }}>
                    {bookmark.category || "Uncategorized"}
                  </span>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      onClick={() => openEdit(bookmark)}
                      title="Edit"
                      style={iconBtn}
                      onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = "var(--surface-hover)"; b.style.color = "var(--accent)"; }}
                      onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = "var(--surface)"; b.style.color = "var(--text-muted)"; }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setDeleteTargetId(bookmark.id)}
                      title="Delete"
                      style={iconBtn}
                      onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = "rgba(239,68,68,0.1)"; b.style.color = "#ef4444"; b.style.borderColor = "rgba(239,68,68,0.3)"; }}
                      onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = "var(--surface)"; b.style.color = "var(--text-muted)"; b.style.borderColor = "var(--border)"; }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        <path d="M10 11v6" /><path d="M14 11v6" />
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Title */}
                <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--text)", marginBottom: "8px", letterSpacing: "-0.2px", lineHeight: 1.4 }}>
                  {bookmark.title}
                </h3>

                {/* URL + date row */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
                  <a
                    href={bookmark.url} target="_blank" rel="noreferrer"
                    style={{
                      fontSize: "12px", color: "var(--accent)", display: "flex",
                      alignItems: "center", gap: "5px",
                      textDecoration: "none", overflow: "hidden",
                      whiteSpace: "nowrap", textOverflow: "ellipsis",
                      flex: 1, minWidth: 0,
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.textDecoration = "underline"}
                    onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.textDecoration = "none"}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                    {bookmark.url}
                  </a>
                  {bookmark.created_at && (
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", flexShrink: 0, marginLeft: "10px" }}>
                      {timeAgo(bookmark.created_at)}
                    </span>
                  )}
                </div>

                {/* AI Summary */}
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px", padding: "12px" }}>
                  <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--accent)", marginBottom: "6px", letterSpacing: "0.08em" }}>
                    ✦ AI SUMMARY
                  </div>
                  <p style={{ fontSize: "12.5px", color: "var(--text-secondary)", lineHeight: 1.65, margin: 0 }}>
                    {bookmark.summary}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* ══════════════════════════ ADD / EDIT DIALOG ════════════════════════ */}
      {isDialogOpen && (
        <div onClick={closeDialog} style={overlayStyle}>
          <div onClick={e => e.stopPropagation()} style={dialogStyle}>

            {/* Dialog header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
              <div>
                <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text)", letterSpacing: "-0.3px" }}>
                  {editingId ? "Edit Bookmark" : "Add New Bookmark"}
                </h2>
                <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "3px" }}>
                  {editingId ? "Update the details below" : "AI will generate a summary automatically"}
                </p>
              </div>
              <button
                onClick={closeDialog}
                style={{ width: "32px", height: "32px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            {/* Title field */}
            <div style={{ marginBottom: "16px" }}>
              <label style={labelStyle}>TITLE</label>
              <input
                placeholder="e.g. OpenAI Documentation"
                value={title}
                onChange={e => setTitle(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") editingId ? updateBookmark() : addBookmark(); }}
                autoFocus
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = "var(--accent)"}
                onBlur={e => e.target.style.borderColor = "var(--border)"}
              />
            </div>

            {/* URL field */}
            <div style={{ marginBottom: "16px" }}>
              <label style={labelStyle}>URL</label>
              <input
                placeholder="https://..."
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") editingId ? updateBookmark() : addBookmark(); }}
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = "var(--accent)"}
                onBlur={e => e.target.style.borderColor = "var(--border)"}
              />
            </div>

            {/* Category override */}
            <div style={{ marginBottom: "20px" }}>
              <label style={labelStyle}>CATEGORY</label>
              <div style={{ position: "relative" }}>
                <select
                  value={selectedCategory ?? ""}
                  onChange={e => setSelectedCategory(e.target.value || null)}
                  style={{
                    ...inputStyle,
                    appearance: "none",
                    paddingRight: "36px",
                    cursor: "pointer",
                    color: selectedCategory ? getCategoryColor(selectedCategory) : "var(--text-muted)",
                  }}
                  onFocus={e => e.target.style.borderColor = "var(--accent)"}
                  onBlur={e => e.target.style.borderColor = "var(--border)"}
                >
                  <option value="">✦ Auto (AI picks)</option>
                  {VALID_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                {/* Chevron icon */}
                <svg
                  style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--text-muted)" }}
                  width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
              {!selectedCategory && (
                <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "5px", marginBottom: 0 }}>
                  Gemini will assign a category automatically.
                </p>
              )}
            </div>

            {error && (
              <p style={{ fontSize: "13px", color: "#f87171", marginBottom: "16px", marginTop: "-4px" }}>
                ⚠ {error}
              </p>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                onClick={closeDialog}
                style={btnSecondary}
                onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-hover)"}
                onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = "var(--surface)"}
              >
                Cancel
              </button>
              <button
                onClick={editingId ? updateBookmark : addBookmark}
                disabled={loading}
                style={{ ...btnPrimary, opacity: loading ? 0.7 : 1, cursor: loading ? "not-allowed" : "pointer" }}
              >
                {loading && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
                    style={{ animation: "spin 0.7s linear infinite" }}>
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                )}
                {loading ? (editingId ? "Saving..." : "Generating Summary...") : editingId ? "Save Changes" : "Add Bookmark"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════ DELETE CONFIRM ════════════════════════════ */}
      {deleteTargetId !== null && (
        <div onClick={() => setDeleteTargetId(null)} style={overlayStyle}>
          <div
            onClick={e => e.stopPropagation()}
            style={{ ...dialogStyle, maxWidth: "380px", border: "1px solid rgba(239,68,68,0.2)", textAlign: "center" }}
          >
            <div style={{
              width: "52px", height: "52px",
              background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: "14px", display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 16px",
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6" /><path d="M14 11v6" />
              </svg>
            </div>
            <h2 style={{ fontSize: "17px", fontWeight: 700, color: "var(--text)", marginBottom: "8px" }}>Delete Bookmark?</h2>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "24px", lineHeight: 1.65 }}>
              This action cannot be undone. The bookmark and its AI summary will be permanently removed.
            </p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => setDeleteTargetId(null)}
                style={{ ...btnSecondary, flex: 1, padding: "10px" }}
                onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-hover)"}
                onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = "var(--surface)"}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                style={{ flex: 1, padding: "10px", background: "#ef4444", border: "none", borderRadius: "12px", color: "white", fontSize: "14px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "background 0.15s" }}
                onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = "#dc2626"}
                onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = "#ef4444"}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
        </div>
      </Show>
    </>
  );
}