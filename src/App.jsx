import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "./supabase.js";


const TABS = ["Products", "Treatments", "Calendar", "Progress", "Guides"];
const TAB_ICONS = ["🧴", "✨", "📅", "📸", "📂"];

const TREATMENT_TYPES = [
  "Face Mask", "Eye Mask", "Sheet Mask", "Exfoliation", "Microneedling",
  "Mesotherapy", "HIFU", "Botox", "Filler", "LED Therapy", "Gua Sha",
  "Facial Massage", "Chemical Peel", "Microdermabrasion", "Hydrafacial",
  "Serum Treatment", "Lip Treatment", "Neck Treatment", "Body Treatment", "Other"
];

const PRODUCT_CATEGORIES = [
  "Cleanser", "Toner", "Serum", "Moisturizer", "SPF", "Eye Cream",
  "Mask", "Exfoliant", "Retinol", "Vitamin C", "Peptides", "Device",
  "Injectable", "Professional Treatment", "Body Care", "Other"
];

const SKIN_CONCERNS = [
  "Anti-aging", "Brightening", "Hydration", "Acne", "Pores",
  "Texture", "Firmness", "Dark spots", "Redness", "Sensitivity"
];

const CONCERN_COLORS = {
  "Anti-aging": "#fde8d8", "Brightening": "#fff3cc", "Hydration": "#d8eeff",
  "Acne": "#ffd8e8", "Pores": "#e8d8ff", "Texture": "#d8ffe8",
  "Firmness": "#ffe8d8", "Dark spots": "#f0d8ff", "Redness": "#ffd8d8",
  "Sensitivity": "#d8f0ff"
};

const RECUR_OPTIONS = [
  { label: "Weekly", days: 7 },
  { label: "Every 2 Weeks", days: 14 },
  { label: "Monthly", days: 30 },
  { label: "Every 6 Weeks", days: 42 },
  { label: "Every 2 Months", days: 60 },
  { label: "Every 3 Months", days: 90 },
  { label: "Every 6 Months", days: 180 },
  { label: "Yearly", days: 365 },
];

const GUIDE_CATEGORIES = ["Protocol", "Technique", "Aftercare", "Mapping", "Product Guide", "Reference", "Other"];


const pad = (n) => String(n).padStart(2, "0");
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const formatDate = (iso) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y}`;
};
const addDays = (iso, days) => {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const daysUntil = (iso) => {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const target = new Date(iso + "T00:00:00");
  return Math.round((target - now) / 86400000);
};

function toBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = (e) => res(e.target.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

// Compress image before upload to keep size small
async function compressImage(file, maxWidth = 1200, quality = 0.8) {
  return new Promise((res) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let w = img.width, h = img.height;
      if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        res(blob || file);
      }, "image/jpeg", quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); res(file); };
    img.src = url;
  });
}

// Upload a file to Supabase Storage and return the public URL
async function uploadToStorage(file, folder = "general") {
  try {
    const compressed = await compressImage(file);
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
    const { data, error } = await supabase.storage
      .from("beauty-images")
      .upload(fileName, compressed, { contentType: "image/jpeg", upsert: true });
    if (error) {
      console.error("Upload error:", error.message);
      alert("Upload failed: " + error.message);
      return null;
    }
    const { data: urlData } = supabase.storage.from("beauty-images").getPublicUrl(fileName);
    return urlData.publicUrl;
  } catch (err) {
    console.error("Upload exception:", err);
    alert("Upload error: " + err.message);
    return null;
  }
}


function Modal({ title, onClose, children }) {
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        <div style={S.modalHeader}>
          <span style={S.modalTitle}>{title}</span>
          <button style={S.closeBtn} onClick={onClose}>×</button>
        </div>
        <div style={{ overflowY: "auto", maxHeight: "70vh" }}>{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={S.label}>{label}</label>
      {children}
    </div>
  );
}

function Spinner() {
  return <div style={S.spinner}>Loading…</div>;
}


const EMPTY_PRODUCT = {
  name: "", brand: "", category: "", purpose: "", concern: [],
  purchaseDate: today(), price: "", purchasedFrom: "", notes: "", finished: false
};

function ProductsTab() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [filter, setFilter] = useState("All");
  const [form, setForm] = useState(EMPTY_PRODUCT);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("products").select("*").order("id", { ascending: false });
    setProducts(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEditingId(null); setForm(EMPTY_PRODUCT); setShowForm(true); };
  const openEdit = (p) => {
    setEditingId(p.id);
    setForm({
      name: p.name || "", brand: p.brand || "", category: p.category || "",
      purpose: p.purpose || "", concern: p.concern || [],
      purchaseDate: p.purchase_date || today(), price: p.price || "",
      purchasedFrom: p.purchased_from || "", notes: p.notes || "",
      finished: p.finished || false
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    const row = {
      name: form.name, brand: form.brand, category: form.category,
      purpose: form.purpose, concern: form.concern,
      purchase_date: form.purchaseDate, price: form.price,
      purchased_from: form.purchasedFrom, notes: form.notes,
      finished: form.finished
    };
    if (editingId) {
      await supabase.from("products").update(row).eq("id", editingId);
    } else {
      await supabase.from("products").insert({ ...row, id: Date.now() });
    }
    setShowForm(false); setEditingId(null); load();
  };

  const toggleFinished = async (p) => {
    await supabase.from("products").update({ finished: !p.finished }).eq("id", p.id);
    load();
  };
  const remove = async (id) => {
    await supabase.from("products").delete().eq("id", id);
    load();
  };

  const toggleConcern = (c) =>
    setForm(f => ({ ...f, concern: f.concern.includes(c) ? f.concern.filter(x => x !== c) : [...f.concern, c] }));

  const filtered = filter === "All" ? products
    : filter === "Active" ? products.filter(p => !p.finished)
    : products.filter(p => p.finished);

  const total = products.reduce((s, p) => s + (parseFloat(p.price) || 0), 0);

  return (
    <div style={S.tabContent}>
      <div style={S.summaryBar}>
        <div style={S.summaryItem}><span style={S.summaryNum}>{products.length}</span><span style={S.summaryLbl}>Products</span></div>
        <div style={S.summaryDivider} />
        <div style={S.summaryItem}><span style={S.summaryNum}>{products.filter(p => !p.finished).length}</span><span style={S.summaryLbl}>Active</span></div>
        <div style={S.summaryDivider} />
        <div style={S.summaryItem}><span style={S.summaryNum}>${total.toFixed(0)}</span><span style={S.summaryLbl}>Invested</span></div>
      </div>

      <div style={S.rowBetween}>
        <div style={S.filterRow}>
          {["All", "Active", "Finished"].map(f => (
            <button key={f} style={{ ...S.chip, ...(filter === f ? S.chipActive : {}) }} onClick={() => setFilter(f)}>{f}</button>
          ))}
        </div>
        <button style={S.primaryBtn} onClick={openAdd}>+ Add</button>
      </div>

      {loading && <Spinner />}

      {!loading && filtered.length === 0 && (
        <div style={S.empty}><div style={S.emptyIcon}>🧴</div><p style={S.emptyText}>No products here yet.</p></div>
      )}

      <div style={S.cardGrid}>
        {filtered.map(p => (
          <div key={p.id} style={{ ...S.card, opacity: p.finished ? 0.55 : 1 }}>
            <div style={S.cardTopRow}>
              {p.category && <span style={S.categoryBadge}>{p.category}</span>}
              {p.price && <span style={S.priceBadge}>${p.price}</span>}
            </div>
            <div style={S.cardName}>{p.name}</div>
            {p.brand && <div style={S.cardBrand}>{p.brand}</div>}
            {p.purpose && (
              <div style={S.cardPurposeBlock}>
                <span style={S.cardPurposeLabel}>How to use</span>
                <div style={S.cardPurpose}>{p.purpose}</div>
              </div>
            )}
            {p.concern?.length > 0 && (
              <div style={S.tagWrap}>
                {p.concern.map(c => (
                  <span key={c} style={{ ...S.concernTag, background: CONCERN_COLORS[c] || "#f0f0f0" }}>{c}</span>
                ))}
              </div>
            )}
            <div style={S.cardActions}>
              {!p.finished && <button style={S.editBtn} onClick={() => openEdit(p)}>✎ Edit</button>}
              <button style={S.ghostBtn} onClick={() => toggleFinished(p)}>
                {p.finished ? "↩ Restore" : "✓ Done"}
              </button>
              <button style={S.dangerBtn} onClick={() => remove(p.id)}>✕</button>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <Modal title={editingId ? "Edit Product" : "Add Product"} onClose={() => { setShowForm(false); setEditingId(null); }}>
          <div style={S.form}>
            <Field label="Product Name *"><input style={S.input} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Vitamin C Serum" /></Field>
            <Field label="Brand"><input style={S.input} value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} placeholder="e.g. SkinCeuticals" /></Field>
            <Field label="Category">
              <select style={S.input} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                <option value="">Select...</option>
                {PRODUCT_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Purpose / How you use it"><input style={S.input} value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))} placeholder="e.g. Morning antioxidant, before SPF" /></Field>
            <Field label="Skin Concerns">
              <div style={S.checkGrid}>
                {SKIN_CONCERNS.map(c => (
                  <label key={c} style={S.checkLabel}>
                    <input type="checkbox" checked={form.concern.includes(c)} onChange={() => toggleConcern(c)} />
                    {c}
                  </label>
                ))}
              </div>
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Purchase Date"><input style={S.input} type="date" value={form.purchaseDate} onChange={e => setForm(f => ({ ...f, purchaseDate: e.target.value }))} /></Field>
              <Field label="Price ($)"><input style={S.input} type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="0.00" /></Field>
            </div>
            <Field label="Purchased From"><input style={S.input} value={form.purchasedFrom} onChange={e => setForm(f => ({ ...f, purchasedFrom: e.target.value }))} placeholder="e.g. Amazon, Sephora, Med Spa" /></Field>
            <Field label="Notes"><textarea style={{ ...S.input, height: 70, resize: "vertical" }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Anything else to remember..." /></Field>
          </div>
          <div style={S.formActions}>
            <button style={S.cancelBtn} onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
            <button style={S.primaryBtn} onClick={save}>{editingId ? "Save Changes" : "Save Product"}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}


function TreatmentsTab() {
  const [treatments, setTreatments] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [view, setView] = useState("log");
  const [form, setForm] = useState({ type: "", date: today(), products: [], duration: "", rating: 5, notes: "", nextSession: "", images: [] });
  const [schedForm, setSchedForm] = useState({ type: "", frequency: "", lastDone: today(), notes: "" });
  const treatImgRef = useRef();

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: t }, { data: s }, { data: p }] = await Promise.all([
      supabase.from("treatments").select("*").order("id", { ascending: false }),
      supabase.from("schedules").select("*").order("next_due"),
      supabase.from("products").select("*").eq("finished", false)
    ]);
    setTreatments(t || []);
    setSchedules(s || []);
    setProducts(p || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleProd = (id) =>
    setForm(f => ({ ...f, products: f.products.includes(id) ? f.products.filter(x => x !== id) : [...f.products, id] }));

  const handleTreatImg = async (e) => {
    const files = Array.from(e.target.files);
    for (const file of files) {
      const previewUrl = URL.createObjectURL(file);
      setForm(f => ({ ...f, images: [...(f.images || []), { file, previewUrl, name: file.name }] }));
    }
    if (treatImgRef.current) treatImgRef.current.value = "";
  };

  const save = async () => {
    if (!form.type) return;
    const id = Date.now();
    await supabase.from("treatments").insert({
      id, type: form.type, date: form.date,
      duration: form.duration, rating: form.rating,
      notes: form.notes, next_session: form.nextSession,
      products: form.products,
    });
    // Upload treatment images to Storage
    for (const img of (form.images || [])) {
      if (img.file) {
        const url = await uploadToStorage(img.file, "treatments");
        if (url) {
          await supabase.from("treatment_images").insert({
            id: Date.now() + Math.floor(Math.random() * 10000),
            treatment_id: id, name: img.name, image_url: url
          });
        }
      }
    }
    setForm({ type: "", date: today(), products: [], duration: "", rating: 5, notes: "", nextSession: "", images: [] });
    setShowForm(false);
    load();
  };

  const saveSchedule = async () => {
    if (!schedForm.type || !schedForm.frequency) return;
    const opt = RECUR_OPTIONS.find(o => o.label === schedForm.frequency);
    const nextDue = addDays(schedForm.lastDone, opt.days);
    await supabase.from("schedules").insert({
      id: Date.now(), type: schedForm.type, frequency: schedForm.frequency,
      last_done: schedForm.lastDone, next_due: nextDue, notes: schedForm.notes
    });
    setSchedForm({ type: "", frequency: "", lastDone: today(), notes: "" });
    setShowScheduleForm(false);
    load();
  };

  const markDone = async (s) => {
    const opt = RECUR_OPTIONS.find(o => o.label === s.frequency);
    const nextDue = addDays(today(), opt.days);
    await supabase.from("schedules").update({ last_done: today(), next_due: nextDue }).eq("id", s.id);
    load();
  };

  const removeTreatment = async (id) => {
    await supabase.from("treatment_images").delete().eq("treatment_id", id);
    await supabase.from("treatments").delete().eq("id", id);
    load();
  };

  const removeSchedule = async (id) => {
    await supabase.from("schedules").delete().eq("id", id);
    load();
  };

  const typeCount = treatments.reduce((acc, t) => { acc[t.type] = (acc[t.type] || 0) + 1; return acc; }, {});
  const topTypes = Object.entries(typeCount).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const overdueCount = schedules.filter(s => daysUntil(s.next_due) < 0).length;

  return (
    <div style={S.tabContent}>
      {topTypes.length > 0 && (
        <div style={S.statsRow}>
          {topTypes.map(([type, count]) => (
            <div key={type} style={S.statCard}>
              <span style={S.statNum}>{count}</span>
              <span style={S.statLbl}>{type}</span>
            </div>
          ))}
        </div>
      )}

      <div style={S.viewToggleRow}>
        <div style={S.viewToggle}>
          <button style={{ ...S.toggleBtn, ...(view === "log" ? S.toggleActive : {}) }} onClick={() => setView("log")}>Treatment Log</button>
          <button style={{ ...S.toggleBtn, ...(view === "schedules" ? S.toggleActive : {}) }} onClick={() => setView("schedules")}>
            Recurring {overdueCount > 0 && <span style={S.overduebadge}>{overdueCount}</span>}
          </button>
        </div>
        <button style={S.primaryBtn} onClick={() => view === "log" ? setShowForm(true) : setShowScheduleForm(true)}>
          {view === "log" ? "+ Log" : "+ Schedule"}
        </button>
      </div>

      {loading && <Spinner />}

      {view === "log" && !loading && (
        <>
          {treatments.length === 0 && <div style={S.empty}><div style={S.emptyIcon}>✨</div><p style={S.emptyText}>No treatments logged yet.</p></div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {treatments.map(t => {
              const usedProds = products.filter(p => t.products?.includes(p.id));
              return (
                <div key={t.id} style={S.treatCard}>
                  <div style={S.treatLeft}>
                    <div style={S.treatType}>{t.type}</div>
                    <div style={S.treatDate}>{formatDate(t.date)}</div>
                    {t.duration && <div style={S.treatMeta}>⏱ {t.duration} min</div>}
                    {t.next_session && <div style={{ ...S.treatMeta, color: "#e8847a" }}>🔄 {formatDate(t.next_session)}</div>}
                  </div>
                  <div style={S.treatRight}>
                    <div style={S.stars}>{"★".repeat(t.rating || 0)}{"☆".repeat(5 - (t.rating || 0))}</div>
                    {usedProds.length > 0 && (
                      <div style={S.tagWrap}>{usedProds.map(p => <span key={p.id} style={S.prodTag}>{p.name}</span>)}</div>
                    )}
                    {t.notes && <div style={S.treatNotes}>{t.notes}</div>}
                  </div>
                  <button style={S.xBtn} onClick={() => removeTreatment(t.id)}>×</button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {view === "schedules" && !loading && (
        <>
          {schedules.length === 0 && <div style={S.empty}><div style={S.emptyIcon}>🔄</div><p style={S.emptyText}>Set up recurring treatments to track when you're due.</p></div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {schedules.map(s => {
              const days = daysUntil(s.next_due);
              const overdue = days < 0, dueSoon = days >= 0 && days <= 7;
              return (
                <div key={s.id} style={{ ...S.schedCard, ...(overdue ? S.schedOverdue : dueSoon ? S.schedSoon : {}) }}>
                  <div style={S.schedTop}>
                    <div>
                      <div style={S.schedType}>{s.type}</div>
                      <div style={S.schedFreq}>{s.frequency}</div>
                    </div>
                    <div style={{ ...S.schedBadge, background: overdue ? "#fde8e8" : dueSoon ? "#fff3e0" : "#e8f5e9", color: overdue ? "#c05050" : dueSoon ? "#c08020" : "#4a8a5a" }}>
                      {overdue ? `${Math.abs(days)}d overdue` : days === 0 ? "Due today!" : `In ${days}d`}
                    </div>
                  </div>
                  <div style={S.schedDates}>
                    <span>Last done: {formatDate(s.last_done)}</span>
                    <span>Next due: {formatDate(s.next_due)}</span>
                  </div>
                  {s.notes && <div style={S.schedNotes}>{s.notes}</div>}
                  <div style={S.schedActions}>
                    <button style={S.primaryBtn} onClick={() => markDone(s)}>✓ Done Today</button>
                    <button style={S.dangerBtn} onClick={() => removeSchedule(s.id)}>Remove</button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {showForm && (
        <Modal title="Log Treatment" onClose={() => setShowForm(false)}>
          <div style={S.form}>
            <Field label="Treatment Type *">
              <select style={S.input} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                <option value="">Select treatment...</option>
                {TREATMENT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Date"><input style={S.input} type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></Field>
              <Field label="Duration (min)"><input style={S.input} type="number" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} placeholder="20" /></Field>
            </div>
            <Field label="Products Used">
              {products.length === 0
                ? <p style={{ color: "#bbb", fontSize: 13 }}>Add products first.</p>
                : <div style={S.checkGrid}>
                  {products.map(p => (
                    <label key={p.id} style={S.checkLabel}>
                      <input type="checkbox" checked={form.products.includes(p.id)} onChange={() => toggleProd(p.id)} />
                      {p.name}
                    </label>
                  ))}
                </div>}
            </Field>
            <Field label="Rating">
              <div style={{ display: "flex", gap: 4 }}>
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} style={{ ...S.starBtn, color: form.rating >= n ? "#f5a623" : "#ddd" }}
                    onClick={() => setForm(f => ({ ...f, rating: n }))}>★</button>
                ))}
              </div>
            </Field>
            <Field label="Schedule Next Session"><input style={S.input} type="date" value={form.nextSession} onChange={e => setForm(f => ({ ...f, nextSession: e.target.value }))} /></Field>
            <Field label="Notes / Results"><textarea style={{ ...S.input, height: 80, resize: "vertical" }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="How did it go?" /></Field>
            <Field label="Treatment Area Photos">
              <input ref={treatImgRef} type="file" accept="image/*" multiple style={{ fontSize: 13, color: "#888" }} onChange={handleTreatImg} />
              {form.images?.length > 0 && (
                <div style={S.treatImgRow}>
                  {form.images.map((img, i) => (
                    <div key={i} style={{ position: "relative", display: "inline-block" }}>
                      <img src={img.previewUrl} alt="" style={S.treatThumb} />
                      <button style={S.imgRemoveBtn} onClick={() => setForm(f => ({ ...f, images: f.images.filter((_, j) => j !== i) }))}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </Field>
          </div>
          <div style={S.formActions}>
            <button style={S.cancelBtn} onClick={() => setShowForm(false)}>Cancel</button>
            <button style={S.primaryBtn} onClick={save}>Log Treatment</button>
          </div>
        </Modal>
      )}

      {showScheduleForm && (
        <Modal title="Add Recurring Schedule" onClose={() => setShowScheduleForm(false)}>
          <div style={S.form}>
            <Field label="Treatment Type *">
              <select style={S.input} value={schedForm.type} onChange={e => setSchedForm(f => ({ ...f, type: e.target.value }))}>
                <option value="">Select treatment...</option>
                {TREATMENT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="How Often? *">
              <div style={S.freqGrid}>
                {RECUR_OPTIONS.map(o => (
                  <button key={o.label}
                    style={{ ...S.freqBtn, ...(schedForm.frequency === o.label ? S.freqActive : {}) }}
                    onClick={() => setSchedForm(f => ({ ...f, frequency: o.label }))}>
                    {o.label}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Last Done (or start date)">
              <input style={S.input} type="date" value={schedForm.lastDone} onChange={e => setSchedForm(f => ({ ...f, lastDone: e.target.value }))} />
            </Field>
            <Field label="Notes">
              <input style={S.input} value={schedForm.notes} onChange={e => setSchedForm(f => ({ ...f, notes: e.target.value }))} placeholder="e.g. Book with Dr. Smith..." />
            </Field>
            {schedForm.type && schedForm.frequency && (
              <div style={S.schedPreview}>
                <span style={{ fontSize: 13, color: "#5a8a5a" }}>
                  ✓ Next due: <strong>{formatDate(addDays(schedForm.lastDone, RECUR_OPTIONS.find(o => o.label === schedForm.frequency)?.days || 0))}</strong>
                </span>
              </div>
            )}
          </div>
          <div style={S.formActions}>
            <button style={S.cancelBtn} onClick={() => setShowScheduleForm(false)}>Cancel</button>
            <button style={S.primaryBtn} onClick={saveSchedule}>Save Schedule</button>
          </div>
        </Modal>
      )}
    </div>
  );
}


function CalendarTab() {
  const [treatments, setTreatments] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    supabase.from("treatments").select("type,date").then(({ data }) => setTreatments(data || []));
    supabase.from("schedules").select("type,next_due").then(({ data }) => setSchedules(data || []));
  }, []);

  const year = now.getFullYear(), month = now.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const byDate = treatments.reduce((acc, t) => {
    if (!acc[t.date]) acc[t.date] = [];
    acc[t.date].push(t);
    return acc;
  }, {});

  const upcoming = schedules
    .filter(s => s.next_due >= today())
    .sort((a, b) => a.next_due.localeCompare(b.next_due))
    .slice(0, 6);

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div style={S.tabContent}>
      <div style={S.calHeader}>
        <button style={S.calNav} onClick={() => setNow(new Date(year, month - 1))}>‹</button>
        <span style={S.calTitle}>{MONTHS[month]} {year}</span>
        <button style={S.calNav} onClick={() => setNow(new Date(year, month + 1))}>›</button>
      </div>
      <div style={S.calGrid}>
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => (
          <div key={d} style={S.calDayName}>{d}</div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} style={S.calEmpty} />;
          const k = `${year}-${pad(month + 1)}-${pad(d)}`;
          const ts = byDate[k] || [];
          const isToday = k === today();
          return (
            <div key={k} style={{ ...S.calCell, ...(isToday ? S.calToday : {}), ...(ts.length > 0 ? S.calHasEvent : {}) }}>
              <span style={{ ...S.calNum, ...(isToday ? S.calNumToday : {}) }}>{d}</span>
              {ts.slice(0, 2).map((t, ti) => <div key={ti} style={S.calDot} title={t.type} />)}
              {ts.length > 2 && <div style={S.calMore}>+{ts.length - 2}</div>}
            </div>
          );
        })}
      </div>
      {upcoming.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={S.sectionTitle}>Upcoming Sessions</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
            {upcoming.map((s, i) => (
              <div key={i} style={S.upcomingRow}>
                <div style={S.upcomingDate}>{formatDate(s.next_due)}</div>
                <div style={S.upcomingType}>{s.type}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


function ProgressTab() {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [compare, setCompare] = useState(null);
  const [form, setForm] = useState({ date: today(), label: "", notes: "", previewFile: null, previewUrl: null });
  const fileRef = useRef();

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("progress_photos").select("*").order("id", { ascending: false });
    setPhotos(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setForm(f => ({ ...f, previewFile: file, previewUrl: URL.createObjectURL(file) }));
  };

  const save = async () => {
    if (!form.previewFile || saving) return;
    setSaving(true);
    const url = await uploadToStorage(form.previewFile, "progress");
    if (!url) { setSaving(false); return; }
    const { error } = await supabase.from("progress_photos").insert({
      id: Date.now(), date: form.date, label: form.label,
      notes: form.notes, image_url: url
    });
    if (error) { alert("Save failed: " + error.message); setSaving(false); return; }
    setForm({ date: today(), label: "", notes: "", previewFile: null, previewUrl: null });
    setShowForm(false);
    if (fileRef.current) fileRef.current.value = "";
    setSaving(false);
    load();
  };

  const remove = async (id) => {
    await supabase.from("progress_photos").delete().eq("id", id);
    load();
  };

  return (
    <div style={S.tabContent}>
      <div style={{ ...S.rowBetween, marginBottom: 16 }}>
        <span style={S.sectionTitle}>{photos.length} Photos</span>
        <button style={S.primaryBtn} onClick={() => setShowForm(true)}>+ Add Photo</button>
      </div>

      {photos.length >= 2 && (
        <div style={S.compareBanner}>
          <span style={{ fontSize: 13, color: "#5a7a9a" }}>📊 Compare two photos side by side</span>
          <button style={S.compareBtn} onClick={() => setCompare(compare !== null ? null : [])}>
            {compare !== null ? "Exit Compare" : "Compare"}
          </button>
        </div>
      )}

      {loading && <Spinner />}
      {!loading && photos.length === 0 && (
        <div style={S.empty}><div style={S.emptyIcon}>📸</div><p style={S.emptyText}>Add progress photos to track your skin journey.</p></div>
      )}

      {compare !== null ? (
        <div>
          <p style={{ fontSize: 13, color: "#8a9aaa", marginBottom: 10 }}>Select two photos to compare:</p>
          <div style={S.photoGrid}>
            {photos.map(p => {
              const sel = compare.includes(p.id);
              return (
                <div key={p.id} style={{ ...S.photoCard, outline: sel ? "2.5px solid #7aadcf" : "none", cursor: "pointer" }}
                  onClick={() => { if (sel) setCompare(compare.filter(x => x !== p.id)); else if (compare.length < 2) setCompare([...compare, p.id]); }}>
                  <img src={p.image_url} alt="" style={S.photoImg} />
                  <div style={S.photoInfo}><div style={S.photoDate}>{formatDate(p.date)}</div>{p.label && <div style={S.photoLabel}>{p.label}</div>}</div>
                  {sel && <div style={S.selectedBadge}>✓</div>}
                </div>
              );
            })}
          </div>
          {compare.length === 2 && (
            <div style={S.compareView}>
              {compare.map(id => { const p = photos.find(x => x.id === id); return p ? (
                <div key={id} style={S.compareItem}>
                  <img src={p.image_url} alt="" style={{ width: "100%", borderRadius: 12, objectFit: "cover", maxHeight: 260 }} />
                  <div style={S.photoDate}>{formatDate(p.date)}</div>
                  {p.label && <div style={S.photoLabel}>{p.label}</div>}
                </div>
              ) : null; })}
            </div>
          )}
        </div>
      ) : (
        <div style={S.photoGrid}>
          {photos.map(p => (
            <div key={p.id} style={S.photoCard}>
              <img src={p.image_url} alt={p.label || "progress"} style={S.photoImg} />
              <div style={S.photoInfo}>
                <div style={S.photoDate}>{formatDate(p.date)}</div>
                {p.label && <div style={S.photoLabel}>{p.label}</div>}
                {p.notes && <div style={S.photoNotes}>{p.notes}</div>}
              </div>
              <button style={S.xBtn} onClick={() => remove(p.id)}>×</button>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <Modal title="Add Progress Photo" onClose={() => setShowForm(false)}>
          <div style={S.form}>
            <Field label="Photo *">
              <input ref={fileRef} type="file" accept="image/*" style={{ fontSize: 13, color: "#888" }} onChange={handleFile} />
            </Field>
            {form.previewUrl && <img src={form.previewUrl} alt="preview" style={{ width: "100%", borderRadius: 12, maxHeight: 200, objectFit: "cover" }} />}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Date"><input style={S.input} type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></Field>
              <Field label="Label"><input style={S.input} value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="e.g. Before HIFU" /></Field>
            </div>
            <Field label="Notes"><textarea style={{ ...S.input, height: 70, resize: "vertical" }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any skin observations..." /></Field>
          </div>
          <div style={S.formActions}>
            <button style={S.cancelBtn} onClick={() => setShowForm(false)}>Cancel</button>
            <button style={{ ...S.primaryBtn, opacity: form.previewFile && !saving ? 1 : 0.45 }} onClick={save}>
              {saving ? "Uploading..." : "Save Photo"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}


function GuidesTab() {
  const [guides, setGuides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [viewGuide, setViewGuide] = useState(null);
  const [filterCat, setFilterCat] = useState("All");
  const [form, setForm] = useState({ title: "", category: "", description: "", previewFile: null, fileName: "", fileType: "", addedDate: today(), previewUrl: null });
  const fileRef = useRef();

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("guides").select("*").order("id", { ascending: false });
    setGuides(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setForm(f => ({ ...f, previewFile: file, fileName: file.name, fileType: file.type, previewUrl: URL.createObjectURL(file) }));
  };

  const save = async () => {
    if (!form.title.trim()) return;
    let fileUrl = null;
    if (form.previewFile) {
      fileUrl = await uploadToStorage(form.previewFile, "guides");
      if (!fileUrl) { alert("File upload failed. Please try again."); return; }
    }
    await supabase.from("guides").insert({
      id: Date.now(), title: form.title, category: form.category,
      description: form.description, file_name: form.fileName,
      file_type: form.fileType, file_url: fileUrl,
      added_date: form.addedDate
    });
    setForm({ title: "", category: "", description: "", previewFile: null, fileName: "", fileType: "", addedDate: today(), previewUrl: null });
    setShowForm(false);
    if (fileRef.current) fileRef.current.value = "";
    load();
  };

  const remove = async (id) => {
    await supabase.from("guides").delete().eq("id", id);
    load();
  };

  const download = (g) => {
    if (!g.file_url) return;
    window.open(g.file_url, "_blank");
  };

  const isImage = (g) => g.file_type?.startsWith("image/");
  const isPDF = (g) => g.file_type === "application/pdf";
  const filtered = filterCat === "All" ? guides : guides.filter(g => g.category === filterCat);
  const usedCats = [...new Set(guides.map(g => g.category).filter(Boolean))];

  return (
    <div style={S.tabContent}>
      <div style={S.guidesHero}>
        <div style={S.guidesHeroIcon}>📂</div>
        <div>
          <div style={S.guidesHeroTitle}>Your Beauty Library</div>
          <div style={S.guidesHeroSub}>Save protocols, technique guides, treatment maps & reference files</div>
        </div>
      </div>

      <div style={S.rowBetween}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button style={{ ...S.chip, ...(filterCat === "All" ? S.chipActive : {}) }} onClick={() => setFilterCat("All")}>All</button>
          {usedCats.map(c => <button key={c} style={{ ...S.chip, ...(filterCat === c ? S.chipActive : {}) }} onClick={() => setFilterCat(c)}>{c}</button>)}
        </div>
        <button style={S.primaryBtn} onClick={() => setShowForm(true)}>+ Add File</button>
      </div>

      {loading && <Spinner />}
      {!loading && filtered.length === 0 && (
        <div style={S.empty}><div style={S.emptyIcon}>📋</div><p style={S.emptyText}>Save your treatment protocols, technique diagrams, aftercare instructions here.</p></div>
      )}

      <div style={S.guidesGrid}>
        {filtered.map(g => (
          <div key={g.id} style={S.guideCard}>
            <div style={{ ...S.guidePreviewWrap, background: isPDF(g) ? "#fff5f0" : isImage(g) ? "#f7f5f2" : "#f5f0ff", cursor: "pointer" }}
              onClick={() => setViewGuide(g)}>
              {isImage(g) && g.file_url
                ? <img src={g.file_url} alt={g.title} style={S.guidePreviewImg} />
                : <><div style={S.guideFileIcon}>{isPDF(g) ? "📄" : "📎"}</div><div style={S.guideFileName}>{g.file_name || "File"}</div></>
              }
            </div>
            <div style={S.guideInfo}>
              <div style={S.guideTitle}>{g.title}</div>
              {g.category && <span style={S.guideCatBadge}>{g.category}</span>}
              {g.description && <div style={S.guideDesc}>{g.description}</div>}
              <div style={S.guideFooter}>
                <span style={S.guideDate}>{formatDate(g.added_date)}</span>
                <div style={{ display: "flex", gap: 6 }}>
                  {g.file_url && <button style={S.ghostBtn} onClick={() => download(g)}>↓ Save</button>}
                  <button style={S.dangerBtn} onClick={() => remove(g.id)}>Remove</button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {viewGuide && (
        <div style={S.overlay} onClick={() => setViewGuide(null)}>
          <div style={{ ...S.modal, maxHeight: "95vh", borderRadius: 16 }} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <span style={S.modalTitle}>{viewGuide.title}</span>
              <button style={S.closeBtn} onClick={() => setViewGuide(null)}>×</button>
            </div>
            <div style={{ overflowY: "auto", flex: 1, paddingBottom: 20 }}>
              {isImage(viewGuide) && viewGuide.file_url && <img src={viewGuide.file_url} alt="" style={{ width: "100%", borderRadius: 10 }} />}
              {isPDF(viewGuide) && viewGuide.file_url && <iframe src={viewGuide.file_url} title={viewGuide.title} style={{ width: "100%", height: 500, border: "none", borderRadius: 10 }} />}
              {viewGuide.description && <p style={{ fontSize: 14, color: "#5a5050", marginTop: 14, lineHeight: 1.6 }}>{viewGuide.description}</p>}
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <Modal title="Add to Library" onClose={() => setShowForm(false)}>
          <div style={S.form}>
            <Field label="Title *"><input style={S.input} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. HIFU Treatment Protocol" /></Field>
            <Field label="Category">
              <select style={S.input} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                <option value="">Select...</option>
                {GUIDE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="File or Image">
              <input ref={fileRef} type="file" accept="image/*,.pdf,.doc,.docx,.txt" style={{ fontSize: 13, color: "#888" }} onChange={handleFile} />
              {form.previewUrl && form.fileType?.startsWith("image/") && <img src={form.previewUrl} alt="preview" style={{ width: "100%", borderRadius: 10, maxHeight: 160, objectFit: "cover", marginTop: 6 }} />}
              {form.fileName && !form.fileType?.startsWith("image/") && <div style={{ fontSize: 13, color: "#c4845a", marginTop: 4 }}>📎 {form.fileName}</div>}
            </Field>
            <Field label="Description / Notes"><textarea style={{ ...S.input, height: 80, resize: "vertical" }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What is this guide for?" /></Field>
          </div>
          <div style={S.formActions}>
            <button style={S.cancelBtn} onClick={() => setShowForm(false)}>Cancel</button>
            <button style={S.primaryBtn} onClick={save}>Save to Library</button>
          </div>
        </Modal>
      )}
    </div>
  );
}


export default function App() {
  const [tab, setTab] = useState(0);
  return (
    <div style={S.app}>
      <div style={S.header}>
        <div style={S.headerContent}>
          <div>
            <div style={S.appName}>DIY Beauty Tracker</div>
            <div style={S.appSub}>Your personal skin ritual log</div>
          </div>
        </div>
      </div>
      <div style={S.nav}>
        {TABS.map((t, i) => (
          <button key={t} style={{ ...S.navBtn, ...(tab === i ? S.navActive : {}) }} onClick={() => setTab(i)}>
            <span style={{ fontSize: 16 }}>{TAB_ICONS[i]}</span>
            <span style={{ fontSize: 11, marginTop: 2 }}>{t}</span>
          </button>
        ))}
      </div>
      {tab === 0 && <ProductsTab />}
      {tab === 1 && <TreatmentsTab />}
      {tab === 2 && <CalendarTab />}
      {tab === 3 && <ProgressTab />}
      {tab === 4 && <GuidesTab />}
    </div>
  );
}


const S = {
  app: { minHeight: "100vh", background: "#f7f5f2", fontFamily: "'DM Sans', sans-serif", color: "#2c2820", maxWidth: 720, margin: "0 auto" },
  header: { background: "#fff", borderBottom: "1px solid #ede8e0", padding: "18px 20px 16px" },
  headerContent: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  appName: { fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 500, color: "#2c2820", letterSpacing: "-0.01em" },
  appSub: { fontSize: 12, color: "#b0a898", marginTop: 2, letterSpacing: "0.04em" },
  nav: { display: "flex", background: "#fff", borderBottom: "1px solid #ede8e0", position: "sticky", top: 0, zIndex: 10 },
  navBtn: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 4px 8px", border: "none", background: "transparent", color: "#b0a898", cursor: "pointer", transition: "all 0.15s", borderBottom: "2px solid transparent", gap: 2 },
  navActive: { color: "#c4845a", borderBottom: "2px solid #c4845a", background: "#fdf9f6" },
  tabContent: { padding: "18px 16px 32px" },
  spinner: { textAlign: "center", padding: 40, color: "#b0a898", fontSize: 14 },
  summaryBar: { display: "flex", background: "#fff", borderRadius: 14, padding: "14px 20px", marginBottom: 16, border: "1px solid #ede8e0", alignItems: "center", justifyContent: "space-around" },
  summaryItem: { display: "flex", flexDirection: "column", alignItems: "center", gap: 2 },
  summaryNum: { fontSize: 22, fontWeight: 600, color: "#c4845a", fontFamily: "'Playfair Display', serif" },
  summaryLbl: { fontSize: 11, color: "#b0a898", textTransform: "uppercase", letterSpacing: "0.05em" },
  summaryDivider: { width: 1, height: 32, background: "#ede8e0" },
  rowBetween: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  sectionTitle: { fontSize: 13, color: "#8a8078", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" },
  filterRow: { display: "flex", gap: 6 },
  chip: { padding: "5px 13px", borderRadius: 20, border: "1px solid #e0d8ce", background: "#fff", color: "#8a8078", fontSize: 12, cursor: "pointer", transition: "all 0.15s" },
  chipActive: { background: "#c4845a", borderColor: "#c4845a", color: "#fff" },
  primaryBtn: { padding: "8px 18px", background: "#c4845a", color: "#fff", border: "none", borderRadius: 20, fontSize: 13, fontWeight: 500, cursor: "pointer", boxShadow: "0 2px 8px rgba(196,132,90,0.25)" },
  ghostBtn: { flex: 1, padding: "6px 0", border: "1px solid #e0d8ce", background: "transparent", color: "#8a8078", borderRadius: 8, fontSize: 11, cursor: "pointer" },
  dangerBtn: { padding: "6px 10px", border: "1px solid #f0dada", background: "transparent", color: "#c08080", borderRadius: 8, fontSize: 11, cursor: "pointer" },
  editBtn: { flex: 1, padding: "6px 0", border: "1px solid #d8ecd8", background: "#f5fbf5", color: "#5a8a5a", borderRadius: 8, fontSize: 11, cursor: "pointer", fontWeight: 500 },
  cancelBtn: { flex: 1, padding: "11px", border: "1px solid #e0d8ce", background: "#fff", borderRadius: 12, color: "#8a8078", fontSize: 14, cursor: "pointer" },
  xBtn: { position: "absolute", top: 8, right: 8, background: "none", border: "none", color: "#d0c8c0", fontSize: 18, cursor: "pointer" },
  starBtn: { background: "none", border: "none", fontSize: 22, cursor: "pointer", padding: "0 2px" },
  empty: { textAlign: "center", padding: "50px 20px" },
  emptyIcon: { fontSize: 44, marginBottom: 10 },
  emptyText: { color: "#c0b8b0", fontSize: 14 },
  card: { background: "#fff", borderRadius: 16, padding: 16, border: "1px solid #ede8e0", boxShadow: "0 1px 6px rgba(0,0,0,0.04)", position: "relative" },
  cardGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12, marginTop: 4 },
  cardTopRow: { display: "flex", justifyContent: "space-between", marginBottom: 8, alignItems: "flex-start" },
  categoryBadge: { background: "#f5f0ea", color: "#9a8878", fontSize: 10, padding: "3px 9px", borderRadius: 10, textTransform: "uppercase", letterSpacing: "0.05em" },
  priceBadge: { background: "#fdf3ea", color: "#c4845a", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 10 },
  cardName: { fontSize: 15, fontWeight: 600, color: "#2c2820", marginBottom: 2 },
  cardBrand: { fontSize: 12, color: "#b0a898", marginBottom: 5 },
  cardPurposeBlock: { background: "#fdf8f4", borderLeft: "2px solid #e8c9b0", borderRadius: "0 6px 6px 0", padding: "5px 8px", marginBottom: 8 },
  cardPurposeLabel: { fontSize: 9, color: "#c4845a", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, display: "block", marginBottom: 2 },
  cardPurpose: { fontSize: 12, color: "#5a5050", lineHeight: 1.4 },
  cardDate: { fontSize: 11, color: "#c0b8b0", marginTop: 6, marginBottom: 8 },
  cardMeta: { marginTop: 6, marginBottom: 8, display: "flex", flexDirection: "column", gap: 3 },
  cardMetaRow: { fontSize: 11, color: "#b0a898" },
  cardActions: { display: "flex", gap: 6 },
  tagWrap: { display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 },
  concernTag: { fontSize: 10, padding: "2px 8px", borderRadius: 10, color: "#5a5050" },
  prodTag: { background: "#f0ece6", color: "#7a7068", fontSize: 10, padding: "2px 8px", borderRadius: 10 },
  statsRow: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  statCard: { background: "#fff", border: "1px solid #ede8e0", borderRadius: 12, padding: "10px 14px", display: "flex", flexDirection: "column", alignItems: "center", minWidth: 72 },
  statNum: { fontSize: 20, fontWeight: 700, color: "#c4845a", fontFamily: "'Playfair Display', serif" },
  statLbl: { fontSize: 10, color: "#b0a898", textAlign: "center", marginTop: 2 },
  viewToggleRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  viewToggle: { display: "flex", background: "#f0ece6", borderRadius: 20, padding: 3, gap: 2 },
  toggleBtn: { padding: "6px 14px", border: "none", borderRadius: 17, background: "transparent", color: "#9a8878", fontSize: 12, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 },
  toggleActive: { background: "#fff", color: "#2c2820", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" },
  overduebadge: { background: "#e85050", color: "#fff", borderRadius: "50%", width: 16, height: 16, fontSize: 10, display: "inline-flex", alignItems: "center", justifyContent: "center" },
  treatCard: { background: "#fff", borderRadius: 14, padding: "14px 14px 14px 16px", border: "1px solid #ede8e0", display: "flex", gap: 14, position: "relative", boxShadow: "0 1px 4px rgba(0,0,0,0.03)" },
  treatLeft: { minWidth: 115 },
  treatType: { fontSize: 14, fontWeight: 600, color: "#2c2820", marginBottom: 3 },
  treatDate: { fontSize: 12, color: "#b0a898" },
  treatMeta: { fontSize: 11, color: "#c0b8b0", marginTop: 3 },
  treatRight: { flex: 1 },
  treatNotes: { fontSize: 12, color: "#8a8078", fontStyle: "italic", marginTop: 4 },
  stars: { fontSize: 13, color: "#f5a623", marginBottom: 5, letterSpacing: 1 },
  treatImgRow: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 },
  treatThumb: { width: 56, height: 56, borderRadius: 8, objectFit: "cover", border: "1px solid #ede8e0" },
  imgRemoveBtn: { position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%", background: "#c08080", color: "#fff", border: "none", fontSize: 11, cursor: "pointer", lineHeight: 1, padding: 0 },
  schedCard: { background: "#fff", borderRadius: 14, padding: 14, border: "1px solid #ede8e0", boxShadow: "0 1px 4px rgba(0,0,0,0.03)" },
  schedOverdue: { border: "1.5px solid #f0c8c8", background: "#fffafa" },
  schedSoon: { border: "1.5px solid #f0e0b8", background: "#fffdf5" },
  schedTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  schedType: { fontSize: 15, fontWeight: 600, color: "#2c2820" },
  schedFreq: { fontSize: 12, color: "#b0a898", marginTop: 2 },
  schedBadge: { fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 12, whiteSpace: "nowrap" },
  schedDates: { display: "flex", gap: 14, fontSize: 11, color: "#b0a898", marginBottom: 6 },
  schedNotes: { fontSize: 12, color: "#8a8078", fontStyle: "italic", marginBottom: 8 },
  schedActions: { display: "flex", gap: 8, marginTop: 10 },
  schedPreview: { background: "#f0fbf0", border: "1px solid #c8e8c8", borderRadius: 10, padding: "8px 12px" },
  freqGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 },
  freqBtn: { padding: "8px 10px", border: "1px solid #e0d8ce", borderRadius: 10, background: "#fdfaf7", color: "#8a8078", fontSize: 12, cursor: "pointer", textAlign: "center" },
  freqActive: { background: "#c4845a", borderColor: "#c4845a", color: "#fff", fontWeight: 600 },
  calHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  calNav: { width: 34, height: 34, background: "#fff", border: "1px solid #e0d8ce", borderRadius: 8, color: "#8a8078", fontSize: 18, cursor: "pointer" },
  calTitle: { fontFamily: "'Playfair Display', serif", fontSize: 18, color: "#2c2820" },
  calGrid: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginBottom: 18 },
  calDayName: { textAlign: "center", fontSize: 10, color: "#c0b8b0", padding: "4px 0 6px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" },
  calEmpty: { minHeight: 52 },
  calCell: { minHeight: 52, background: "#fff", borderRadius: 8, padding: "5px 4px", border: "1px solid #ede8e0", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 },
  calToday: { background: "#fdf3ea", border: "1.5px solid #c4845a" },
  calHasEvent: { background: "#f7f2ee" },
  calNum: { fontSize: 11, color: "#8a8078" },
  calNumToday: { color: "#c4845a", fontWeight: 700 },
  calDot: { width: 5, height: 5, borderRadius: "50%", background: "#c4845a" },
  calMore: { fontSize: 8, color: "#c4845a" },
  upcomingRow: { background: "#fff", borderRadius: 10, padding: "10px 14px", border: "1px solid #ede8e0", display: "flex", alignItems: "center", gap: 12 },
  upcomingDate: { fontSize: 12, color: "#b0a898", minWidth: 70 },
  upcomingType: { fontSize: 13, fontWeight: 600, color: "#2c2820", flex: 1 },
  photoGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 },
  photoCard: { background: "#fff", borderRadius: 14, overflow: "hidden", border: "1px solid #ede8e0", position: "relative", boxShadow: "0 1px 6px rgba(0,0,0,0.04)" },
  photoImg: { width: "100%", height: 160, objectFit: "cover", display: "block" },
  photoInfo: { padding: "8px 10px 10px" },
  photoDate: { fontSize: 11, color: "#b0a898" },
  photoLabel: { fontSize: 12, fontWeight: 600, color: "#2c2820", marginTop: 2 },
  photoNotes: { fontSize: 11, color: "#8a8078", marginTop: 3, fontStyle: "italic" },
  selectedBadge: { position: "absolute", top: 6, right: 6, background: "#c4845a", color: "#fff", borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 },
  compareBanner: { background: "#edf4fa", border: "1px solid #cce0f0", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  compareBtn: { padding: "5px 14px", background: "#e8f2fa", border: "1px solid #bdd8ec", borderRadius: 16, color: "#5a8aaa", fontSize: 12, cursor: "pointer" },
  compareView: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16, background: "#fff", borderRadius: 14, padding: 14, border: "1px solid #ede8e0" },
  compareItem: { display: "flex", flexDirection: "column", gap: 5 },
  guidesHero: { display: "flex", alignItems: "center", gap: 14, background: "linear-gradient(135deg, #fff9f5 0%, #fff5ee 100%)", border: "1px solid #f0e4d8", borderRadius: 16, padding: "16px 18px", marginBottom: 18 },
  guidesHeroIcon: { fontSize: 32 },
  guidesHeroTitle: { fontFamily: "'Playfair Display', serif", fontSize: 16, color: "#2c2820", marginBottom: 3 },
  guidesHeroSub: { fontSize: 12, color: "#b0a898", lineHeight: 1.4 },
  guidesGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14, marginTop: 14 },
  guideCard: { background: "#fff", borderRadius: 16, border: "1px solid #ede8e0", overflow: "hidden", boxShadow: "0 1px 6px rgba(0,0,0,0.04)" },
  guidePreviewWrap: { height: 120, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative", overflow: "hidden" },
  guidePreviewImg: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  guideFileIcon: { fontSize: 36, marginBottom: 6 },
  guideFileName: { fontSize: 11, color: "#b0a898", textAlign: "center", padding: "0 8px", wordBreak: "break-all" },
  guideInfo: { padding: "12px 12px 10px" },
  guideTitle: { fontSize: 14, fontWeight: 600, color: "#2c2820", marginBottom: 5 },
  guideCatBadge: { display: "inline-block", background: "#fdf0e8", color: "#c4845a", fontSize: 10, padding: "2px 8px", borderRadius: 10, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 5 },
  guideDesc: { fontSize: 12, color: "#8a8078", lineHeight: 1.5, marginBottom: 6 },
  guideFooter: { display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 },
  guideDate: { fontSize: 11, color: "#c0b8b0" },
  overlay: { position: "fixed", inset: 0, background: "rgba(30,25,20,0.4)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50, backdropFilter: "blur(3px)" },
  modal: { background: "#fff", borderRadius: "20px 20px 0 0", padding: "20px 20px 0", width: "100%", maxWidth: 560, maxHeight: "92vh", display: "flex", flexDirection: "column" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid #f0ece6", flexShrink: 0 },
  modalTitle: { fontFamily: "'Playfair Display', serif", fontSize: 18, color: "#2c2820" },
  closeBtn: { background: "none", border: "none", fontSize: 26, color: "#c0b8b0", cursor: "pointer" },
  form: { display: "flex", flexDirection: "column", gap: 12, paddingBottom: 8 },
  label: { fontSize: 12, color: "#b0a898", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" },
  input: { padding: "9px 12px", borderRadius: 10, border: "1px solid #e0d8ce", fontSize: 14, outline: "none", background: "#fdfaf7", color: "#2c2820", width: "100%", transition: "border-color 0.15s" },
  checkGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 },
  checkLabel: { display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "#5a5050", cursor: "pointer" },
  formActions: { display: "flex", gap: 10, padding: "14px 0 28px", flexShrink: 0 },
};
