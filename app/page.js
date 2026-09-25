'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

const PALETTE = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b',
  '#a855f7', '#06b6d4', '#ec4899', '#64748b',
];

const ELECTRICITY_SYSTEMS = [
  { key: 'cooling', name: 'Cooling System', color: '#3b82f6' },
  { key: 'lighting', name: 'Lighting System', color: '#f59e0b' },
  { key: 'production', name: 'Production System', color: '#22c55e' },
  { key: 'air_conditioning', name: 'Air Conditioning System', color: '#a855f7' },
  { key: 'others', name: 'Others', color: '#64748b' },
];

const MONTH_NAMES = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 11 }, (_, i) => CURRENT_YEAR - 5 + i);

function periodToDate(periodType, month, year) {
  if (periodType === 'yearly') return `${year}-01-01`;
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

function periodToLabel(periodType, month, year) {
  if (periodType === 'yearly') return `ปี ${year}`;
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

export default function DashboardPage() {
  const [energyTypes, setEnergyTypes] = useState([]);
  const [records, setRecords] = useState([]);
  const [breakdown, setBreakdown] = useState([]);
  const [loading, setLoading] = useState(true);

  const [periodType, setPeriodType] = useState('monthly'); // 'monthly' | 'yearly'

  // ตัวเลือกที่กำลังจะเพิ่มใน dropdown
  const [pickMonth, setPickMonth] = useState(new Date().getMonth() + 1);
  const [pickYear, setPickYear] = useState(CURRENT_YEAR);

  // รายการช่วงเวลาที่ถูกเลือกไว้ แยกเก็บของ monthly / yearly คนละชุด สลับโหมดแล้วไม่หาย
  const [selected, setSelected] = useState({
    monthly: [{ month: new Date().getMonth() + 1, year: CURRENT_YEAR }],
    yearly: [{ year: CURRENT_YEAR }],
  });

  const currentSelection = selected[periodType];

  useEffect(() => {
    fetchEnergyTypes();
  }, []);

  useEffect(() => {
    fetchRecords();
    fetchBreakdown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodType, selected]);

  async function fetchEnergyTypes() {
    const { data, error } = await supabase
      .from('energy_types')
      .select('*')
      .eq('is_active', true)
      .order('id', { ascending: true });

    if (!error) setEnergyTypes(data || []);
  }

  function selectedDates() {
    return currentSelection.map((p) =>
      periodType === 'yearly' ? periodToDate('yearly', null, p.year) : periodToDate('monthly', p.month, p.year)
    );
  }

  async function fetchRecords() {
    const dates = selectedDates();
    if (dates.length === 0) {
      setRecords([]);
      setLoading(false);
      return;
    }
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
          energy_types ( energy_name, energy_key, unit )
        )
      `)
      .eq('period_type', periodType)
      .in('record_date', dates)
      .order('record_date', { ascending: true });

    if (!error) setRecords(data || []);
    setLoading(false);
  }

  async function fetchBreakdown() {
    const dates = selectedDates();
    if (dates.length === 0) {
      setBreakdown([]);
      return;
    }

    const { data, error } = await supabase
      .from('electricity_breakdown')
      .select('system_key, value, energy_data!inner(record_date, period_type)')
      .eq('energy_data.period_type', periodType)
      .in('energy_data.record_date', dates);

    if (error) {
      console.error(error);
      setBreakdown([]);
      return;
    }

    const totals = {};
    ELECTRICITY_SYSTEMS.forEach((s) => { totals[s.key] = 0; });
    (data || []).forEach((row) => {
      if (totals[row.system_key] !== undefined) {
        totals[row.system_key] += Number(row.value || 0);
      }
    });

    setBreakdown(ELECTRICITY_SYSTEMS.map((s) => ({ ...s, value: totals[s.key] })));
  }

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

  // ---------- จัดการรายการที่เลือก ----------
  function addSelection() {
    setSelected((prev) => {
      const list = prev[periodType];
      const exists =
        periodType === 'monthly'
          ? list.some((p) => p.month === pickMonth && p.year === pickYear)
          : list.some((p) => p.year === pickYear);

      if (exists) return prev;

      const newItem = periodType === 'monthly' ? { month: pickMonth, year: pickYear } : { year: pickYear };
      return { ...prev, [periodType]: [...list, newItem] };
    });
  }

  function removeSelection(idx) {
    setSelected((prev) => {
      const list = prev[periodType].filter((_, i) => i !== idx);
      return { ...prev, [periodType]: list };
    });
  }

  const chartData = buildChartData();
  const breakdownTotal = breakdown.reduce((sum, b) => sum + b.value, 0);

  return (
    <div style={{ padding: '32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, margin: 0 }}>⚡ Factory Energy Management</h1>
          <p style={{ color: '#64748b', marginTop: '4px' }}>ภาพรวมการใช้พลังงานของโรงงาน</p>
        </div>
      </div>

      {/* เลือกโหมด รายเดือน/รายปี */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {['monthly', 'yearly'].map((mode) => (
          <button
            key={mode}
            onClick={() => setPeriodType(mode)}
            style={{
              padding: '8px 16px', borderRadius: '6px', border: '1px solid #e2e8f0',
              background: periodType === mode ? '#1e293b' : 'white',
              color: periodType === mode ? 'white' : '#1e293b',
              cursor: 'pointer', fontWeight: 500,
            }}
          >
            {mode === 'monthly' ? 'รายเดือน' : 'รายปี'}
          </button>
        ))}
      </div>

      {/* dropdown เลือกเดือน/ปี ที่จะเพิ่มเข้ามาดูในกราฟ */}
      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          {periodType === 'monthly' && (
            <div>
              <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>เดือน</label>
              <select
                value={pickMonth}
                onChange={(e) => setPickMonth(Number(e.target.value))}
                style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              >
                {MONTH_NAMES.map((name, i) => (
                  <option key={i} value={i + 1}>{name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>ปี</label>
            <select
              value={pickYear}
              onChange={(e) => setPickYear(Number(e.target.value))}
              style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            >
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <button
            onClick={addSelection}
            style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#3b82f6', color: 'white', fontWeight: 600, cursor: 'pointer' }}
          >
            + เพิ่มเข้ากราฟ
          </button>
        </div>

        {/* chip แสดงรายการที่เลือกไว้ ลบออกได้ทีละอัน */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '14px' }}>
          {currentSelection.length === 0 ? (
            <span style={{ color: '#94a3b8', fontSize: '13px' }}>ยังไม่ได้เลือกช่วงเวลา — เพิ่มอย่างน้อย 1 รายการเพื่อดูกราฟ</span>
          ) : (
            currentSelection.map((p, i) => (
              <span
                key={i}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  background: '#eff6ff', color: '#1e40af', borderRadius: '999px',
                  padding: '4px 6px 4px 12px', fontSize: '13px',
                }}
              >
                {periodType === 'monthly' ? periodToLabel('monthly', p.month, p.year) : periodToLabel('yearly', null, p.year)}
                <button
                  onClick={() => removeSelection(i)}
                  style={{ border: 'none', background: 'none', color: '#1e40af', cursor: 'pointer', fontWeight: 700, padding: '0 4px' }}
                  title="เอาออก"
                >
                  ×
                </button>
              </span>
            ))
          )}
        </div>
      </div>

      {loading ? (
        <p>กำลังโหลดข้อมูล...</p>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '28px' }}>
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px' }}>
              <div style={{ color: '#64748b', fontSize: '13px' }}>พลังงานรวมทุกประเภท</div>
              <div style={{ fontSize: '26px', fontWeight: 700, marginTop: '4px' }}>
                {grandTotal().toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
            </div>
            {energyTypes.map((t, i) => (
              <div key={t.id} style={{ background: 'white', border: '1px solid #e2e8f0', borderLeft: `4px solid ${PALETTE[i % PALETTE.length]}`, borderRadius: '12px', padding: '20px' }}>
                <div style={{ color: '#64748b', fontSize: '13px' }}>{t.energy_name} ({t.unit})</div>
                <div style={{ fontSize: '22px', fontWeight: 700, marginTop: '4px' }}>
                  {totalForType(t.id).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: '20px', marginBottom: '20px' }}>
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px' }}>
              <h3 style={{ marginTop: 0 }}>การใช้พลังงานตามช่วงเวลาที่เลือก</h3>
              {chartData.length === 0 ? (
                <p style={{ color: '#94a3b8' }}>
                  ไม่มีข้อมูลใน energy_data ตรงกับช่วงเวลาที่เลือกไว้ — ลองเพิ่มข้อมูลหรือเลือกช่วงเวลาอื่น
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="key" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {energyTypes.map((t, i) => (
                      <Bar key={t.id} dataKey={t.energy_name} fill={PALETTE[i % PALETTE.length]} radius={[4, 4, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px' }}>
              <h3 style={{ marginTop: 0 }}>สัดส่วนการใช้ไฟฟ้าตามระบบ</h3>
              {breakdownTotal === 0 ? (
                <p style={{ color: '#94a3b8' }}>
                  ไม่มีข้อมูลสัดส่วนไฟฟ้าตรงกับช่วงเวลาที่เลือก — เพิ่มได้ที่หน้า Energy Data
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <PieChart>
                    <Pie
                      data={breakdown}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={110}
                      label={({ name, value, percent }) =>
                        `${name}: ${(percent * 100).toFixed(1)}% (${value.toLocaleString()} kWh)`
                      }
                    >
                      {breakdown.map((b) => (
                        <Cell key={b.key} fill={b.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `${Number(value).toLocaleString()} kWh`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
