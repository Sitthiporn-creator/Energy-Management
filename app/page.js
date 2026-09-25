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

// สีกำหนดเองภายในระบบ ไล่ตามลำดับประเภทพลังงาน ไม่ต้องให้ผู้ใช้เลือก
const PALETTE = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b',
  '#a855f7', '#06b6d4', '#ec4899', '#64748b',
];

// รายชื่อระบบไฟฟ้าย่อย (ต้องตรงกับหน้า Energy Data)
const ELECTRICITY_SYSTEMS = [
  { key: 'cooling', name: 'Cooling System', color: '#3b82f6' },
  { key: 'lighting', name: 'Lighting System', color: '#f59e0b' },
  { key: 'production', name: 'Production System', color: '#22c55e' },
  { key: 'air_conditioning', name: 'Air Conditioning System', color: '#a855f7' },
  { key: 'others', name: 'Others', color: '#64748b' },
];

export default function DashboardPage() {
  const [energyTypes, setEnergyTypes] = useState([]);
  const [records, setRecords] = useState([]); // energy_data + nested energy_values
  const [breakdown, setBreakdown] = useState([]); // [{key, name, color, value}]
  const [viewMode, setViewMode] = useState('monthly'); // ต้องตรงกับค่าที่ใช้เก็บใน period_type
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEnergyTypes();
  }, []);

  useEffect(() => {
    fetchRecords();
    fetchBreakdown();
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
          energy_types ( energy_name, energy_key, unit )
        )
      `)
      .eq('period_type', viewMode)
      .order('record_date', { ascending: true });

    if (!error) setRecords(data || []);
    setLoading(false);
  }

  // ดึงสัดส่วนไฟฟ้าตามระบบ รวมทุก record ในช่วงเวลาที่เลือก (รายเดือน/รายปี)
  async function fetchBreakdown() {
    const { data, error } = await supabase
      .from('electricity_breakdown')
      .select('system_key, value, energy_data!inner(period_type)')
      .eq('energy_data.period_type', viewMode);

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

  // แปลง records (energy_data + energy_values ซ้อนอยู่ข้างใน) ให้เป็นรูปแบบที่กราฟใช้ได้
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
  const breakdownTotal = breakdown.reduce((sum, b) => sum + b.value, 0);

  return (
    <div style={{ padding: '32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, margin: 0 }}>⚡ Factory Energy Management</h1>
          <p style={{ color: '#64748b', marginTop: '4px' }}>ภาพรวมการใช้พลังงานของโรงงาน</p>
        </div>
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
            {energyTypes.map((t, i) => (
              <div key={t.id} style={{ background: 'white', border: '1px solid #e2e8f0', borderLeft: `4px solid ${PALETTE[i % PALETTE.length]}`, borderRadius: '12px', padding: '20px' }}>
                <div style={{ color: '#64748b', fontSize: '13px' }}>{t.energy_name} ({t.unit})</div>
                <div style={{ fontSize: '22px', fontWeight: 700, marginTop: '4px' }}>
                  {totalForType(t.id).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </div>
              </div>
            ))}
          </div>

          {/* กราฟหลัก + Pie chart สัดส่วนไฟฟ้า วางคู่กัน */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: '20px', marginBottom: '20px' }}>
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
                  ยังไม่มีข้อมูลสัดส่วนไฟฟ้า — เพิ่มได้ที่หน้า Energy Data
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
