'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

const ICON_OPTIONS = ['⚡', '🔥', '💧', '🛢️', '🌱', '☀️', '🔋', '⚙️'];
const COLOR_OPTIONS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b',
  '#a855f7', '#06b6d4', '#ec4899', '#64748b',
];

export default function DashboardPage() {
  const [energyTypes, setEnergyTypes] = useState([]);
  const [records, setRecords] = useState([]); // energy_data + nested energy_values
  const [viewMode, setViewMode] = useState('monthly'); // ต้องตรงกับค่าที่ใช้เก็บใน period_type
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    unit: '',
    color: COLOR_OPTIONS[0],
    icon: ICON_OPTIONS[0],
  });

  useEffect(() => {
    fetchEnergyTypes();
  }, []);

  useEffect(() => {
    fetchRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);

  async function fetchEnergyTypes() {
    const { data, error } = await supabase
      .from('energy_types')
      .select('*')
      .eq('is_active', true)
      .order('id', { ascending: true });

    if (!error) setEnergyTypes(data || []);
  }

  async function fetchRecords() {
    setLoading(true);

    const { data, error } = await supabase
      .from('energy_data')
      .select(`
        id,
        record_date,
        period_type,
        period_label,
        note,
        energy_values (
          value,
          energy_type_id,
          energy_types ( energy_name, energy_key, unit, color, icon )
        )
      `)
      .eq('period_type', viewMode)
      .order('record_date', { ascending: true });

    if (!error) setRecords(data || []);
    setLoading(false);
  }

  async function handleAddType(e) {
    e.preventDefault();
    if (!form.name || !form.unit) return;

    setSaving(true);
    const { error } = await supabase.from('energy_types').insert({
      energy_name: form.name,
      energy_key: form.name.toLowerCase().trim().replace(/\s+/g, '_'),
      unit: form.unit,
      color: form.color,
      icon: form.icon,
      is_active: true,
    });
    setSaving(false);

    if (!error) {
      setForm({ name: '', unit: '', color: COLOR_OPTIONS[0], icon: ICON_OPTIONS[0] });
      setShowAddModal(false);
      fetchEnergyTypes();
    } else {
      alert('เพิ่มประเภทพลังงานไม่สำเร็จ: ' + error.message);
    }
  }

  // แปลง records (energy_data + energy_values ซ้อนอยู่ข้างใน) ให้เป็นรูปแบบที่กราฟใช้ได้
  // ผลลัพธ์: [{ key: period_label, 'ไฟฟ้า': 120, 'LPG': 30, ... }, ...]
  function buildChartData() {
    return records.map((r) => {
      const row = { key: r.period_label || r.record_date };
      (r.energy_values || []).forEach((v) => {
        const typeName = v.energy_types?.energy_name || 'ไม่ทราบ';
        row[typeName] = Number(v.value || 0);
      });
      return row;
    });
  }

  function totalForType(typeId) {
    return records.reduce((sum, r) => {
      const match = (r.energy_values || []).find((v) => v.energy_type_id === typeId);
      return sum + (match ? Number(match.value || 0) : 0);
    }, 0);
  }

  function grandTotal() {
    return records.reduce((sum, r) => {
      const sub = (r.energy_values || []).reduce((s, v) => s + Number(v.value || 0), 0);
      return sum + sub;
    }, 0);
  }

  const chartData = buildChartData();

  return (
    <div style={{ padding: '32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, margin: 0 }}>⚡ Factory Energy Management</h1>
          <p style={{ color: '#64748b', marginTop: '4px' }}>ภาพรวมการใช้พลังงานของโรงงาน</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            background: '#3b82f6', color: 'white', border: 'none',
            borderRadius: '8px', padding: '10px 18px', fontWeight: 600, cursor: 'pointer',
          }}
        >
          + เพิ่มประเภทพลังงาน
        </button>
      </div>

      {/* Toggle รายเดือน/รายปี */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {['monthly', 'yearly'].map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            style={{
              padding: '8px 16px', borderRadius: '6px', border: '1px solid #e2e8f0',
              background: viewMode === mode ? '#1e293b' : 'white',
              color: viewMode === mode ? 'white' : '#1e293b',
              cursor: 'pointer', fontWeight: 500,
            }}
          >
            {mode === 'monthly' ? 'รายเดือน' : 'รายปี'}
          </button>
        ))}
      </div>

      {loading ? (
        <p>กำลังโหลดข้อมูล...</p>
      ) : (
        <>
          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '28px' }}>
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px' }}>
              <div style={{ color: '#64748b', fontSize: '13px' }}>พลังงานรวมทุกประเภท</div>
              <div style={{ fontSize: '26px', fontWeight: 700, marginTop: '4px' }}>
                {grandTotal().toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
            </div>
            {energyTypes.map((t) => (
              <div key={t.id} style={{ background: 'white', border: '1px solid #e2e8f0', borderLeft: `4px solid ${t.color || '#3b82f6'}`, borderRadius: '12px', padding: '20px' }}>
                <div style={{ color: '#64748b', fontSize: '13px' }}>{t.icon} {t.energy_name} ({t.unit})</div>
                <div style={{ fontSize: '22px', fontWeight: 700, marginTop: '4px' }}>
                  {totalForType(t.id).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </div>
              </div>
            ))}
          </div>

          {/* กราฟหลัก */}
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px' }}>
            <h3 style={{ marginTop: 0 }}>การใช้พลังงาน{viewMode === 'monthly' ? 'รายเดือน' : 'รายปี'}</h3>
            {chartData.length === 0 ? (
              <p style={{ color: '#94a3b8' }}>
                ยังไม่มีข้อมูลใน energy_data ที่ period_type = &quot;{viewMode}&quot; — ลองเพิ่มข้อมูลในตารางก่อน
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="key" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {energyTypes.map((t) => (
                    <Bar key={t.id} dataKey={t.energy_name} fill={t.color || '#3b82f6'} radius={[4, 4, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </>
      )}

      {/* Modal เพิ่มประเภทพลังงาน */}
      {showAddModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
          onClick={() => setShowAddModal(false)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleAddType}
            style={{ background: 'white', borderRadius: '12px', padding: '24px', width: '360px' }}
          >
            <h3 style={{ marginTop: 0 }}>เพิ่มประเภทพลังงานใหม่</h3>

            <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>ชื่อประเภท</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="เช่น น้ำมันดีเซล"
              required
              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '12px' }}
            />

            <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>หน่วย</label>
            <input
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              placeholder="เช่น L, kWh, kg"
              required
              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '12px' }}
            />

            <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>สี</label>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
              {COLOR_OPTIONS.map((c) => (
                <div
                  key={c}
                  onClick={() => setForm({ ...form, color: c })}
                  style={{
                    width: '26px', height: '26px', borderRadius: '50%', background: c, cursor: 'pointer',
                    border: form.color === c ? '2px solid #1e293b' : '2px solid transparent',
                  }}
                />
              ))}
            </div>

            <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>ไอคอน</label>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '18px', flexWrap: 'wrap' }}>
              {ICON_OPTIONS.map((ic) => (
                <div
                  key={ic}
                  onClick={() => setForm({ ...form, icon: ic })}
                  style={{
                    width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: '6px', cursor: 'pointer', fontSize: '18px',
                    border: form.icon === ic ? '2px solid #1e293b' : '1px solid #e2e8f0',
                  }}
                >
                  {ic}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowAddModal(false)} style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer' }}>
                ยกเลิก
              </button>
              <button type="submit" disabled={saving} style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', background: '#3b82f6', color: 'white', cursor: 'pointer' }}>
                {saving ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
