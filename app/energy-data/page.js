'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function EnergyDataPage() {
  const [energyTypes, setEnergyTypes] = useState([]);
  const [entries, setEntries] = useState([]); // ประวัติ energy_data ล่าสุด
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddTypeForm, setShowAddTypeForm] = useState(false);

  // ฟอร์มเพิ่มประเภทพลังงานใหม่
  const [typeForm, setTypeForm] = useState({ name: '', unit: '' });

  // ฟอร์มกรอกข้อมูลการใช้พลังงาน 1 งวด
  const [entryForm, setEntryForm] = useState({
    record_date: new Date().toISOString().slice(0, 10),
    period_type: 'monthly',
    period_label: '',
    note: '',
    values: {}, // { [energy_type_id]: value }
  });

  useEffect(() => {
    fetchEnergyTypes();
    fetchEntries();
  }, []);

  async function fetchEnergyTypes() {
    const { data, error } = await supabase
      .from('energy_types')
      .select('*')
      .eq('is_active', true)
      .order('id', { ascending: true });

    if (!error) setEnergyTypes(data || []);
  }

  async function fetchEntries() {
    setLoading(true);
    const { data, error } = await supabase
      .from('energy_data')
      .select(`
        id, record_date, period_type, period_label, note,
        energy_values ( value, energy_type_id, energy_types ( energy_name, unit ) )
      `)
      .order('record_date', { ascending: false })
      .limit(20);

    if (!error) setEntries(data || []);
    setLoading(false);
  }

  async function handleAddType(e) {
    e.preventDefault();
    if (!typeForm.name || !typeForm.unit) return;

    setSaving(true);
    const { error } = await supabase.from('energy_types').insert({
      energy_name: typeForm.name,
      energy_key: typeForm.name.toLowerCase().trim().replace(/\s+/g, '_'),
      unit: typeForm.unit,
      is_active: true,
    });
    setSaving(false);

    if (!error) {
      setTypeForm({ name: '', unit: '' });
      setShowAddTypeForm(false);
      fetchEnergyTypes();
    } else {
      alert('เพิ่มประเภทพลังงานไม่สำเร็จ: ' + error.message);
    }
  }

  async function handleAddEntry(e) {
    e.preventDefault();
    setSaving(true);

    // 1) สร้างแถวใน energy_data ก่อน (1 แถว = 1 งวด)
    const { data: dataRow, error: dataError } = await supabase
      .from('energy_data')
      .insert({
        record_date: entryForm.record_date,
        period_type: entryForm.period_type,
        period_label: entryForm.period_label || entryForm.record_date,
        note: entryForm.note || null,
      })
      .select()
      .single();

    if (dataError || !dataRow) {
      setSaving(false);
      alert('บันทึกข้อมูลไม่สำเร็จ: ' + dataError?.message);
      return;
    }

    // 2) สร้างแถวค่าพลังงานแต่ละประเภทใน energy_values ผูกกับ energy_data ที่เพิ่งสร้าง
    const valueRows = energyTypes
      .filter((t) => entryForm.values[t.id] !== undefined && entryForm.values[t.id] !== '')
      .map((t) => ({
        energy_data_id: dataRow.id,
        energy_type_id: t.id,
        value: Number(entryForm.values[t.id]),
      }));

    if (valueRows.length > 0) {
      const { error: valuesError } = await supabase.from('energy_values').insert(valueRows);
      if (valuesError) {
        alert('บันทึกค่าพลังงานไม่สำเร็จ: ' + valuesError.message);
      }
    }

    setSaving(false);
    setEntryForm({
      record_date: new Date().toISOString().slice(0, 10),
      period_type: 'monthly',
      period_label: '',
      note: '',
      values: {},
    });
    fetchEntries();
  }

  return (
    <div style={{ padding: '32px', maxWidth: '900px' }}>
      <h1 style={{ fontSize: '26px', fontWeight: 700 }}>📋 Energy Data</h1>
      <p style={{ color: '#64748b', marginTop: '-8px' }}>กรอกข้อมูลการใช้พลังงานแต่ละงวด</p>

      {/* ประเภทพลังงานที่มีอยู่ + ปุ่มเพิ่ม */}
      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', marginTop: '20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>ประเภทพลังงาน</h3>
          <button
            onClick={() => setShowAddTypeForm((v) => !v)}
            style={{ background: 'none', border: '1px solid #3b82f6', color: '#3b82f6', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer' }}
          >
            {showAddTypeForm ? 'ยกเลิก' : '+ เพิ่มประเภทพลังงาน'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
          {energyTypes.map((t) => (
            <span key={t.id} style={{ background: '#f1f5f9', borderRadius: '999px', padding: '4px 12px', fontSize: '13px' }}>
              {t.energy_name} ({t.unit})
            </span>
          ))}
        </div>

        {showAddTypeForm && (
          <form onSubmit={handleAddType} style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <input
              value={typeForm.name}
              onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
              placeholder="ชื่อประเภท เช่น น้ำมันดีเซล"
              required
              style={{ flex: 2, padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
            <input
              value={typeForm.unit}
              onChange={(e) => setTypeForm({ ...typeForm, unit: e.target.value })}
              placeholder="หน่วย เช่น L"
              required
              style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
            <button type="submit" disabled={saving} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#3b82f6', color: 'white', cursor: 'pointer' }}>
              บันทึก
            </button>
          </form>
        )}
      </div>

      {/* ฟอร์มกรอกข้อมูลการใช้พลังงาน */}
      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', marginBottom: '28px' }}>
        <h3 style={{ marginTop: 0 }}>เพิ่มข้อมูลการใช้พลังงาน</h3>

        <form onSubmit={handleAddEntry}>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '140px' }}>
              <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>วันที่บันทึก</label>
              <input
                type="date"
                value={entryForm.record_date}
                onChange={(e) => setEntryForm({ ...entryForm, record_date: e.target.value })}
                required
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div style={{ flex: 1, minWidth: '140px' }}>
              <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>ประเภทช่วงเวลา</label>
              <select
                value={entryForm.period_type}
                onChange={(e) => setEntryForm({ ...entryForm, period_type: e.target.value })}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              >
                <option value="monthly">รายเดือน</option>
                <option value="yearly">รายปี</option>
              </select>
            </div>

            <div style={{ flex: 1, minWidth: '140px' }}>
              <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>ป้ายกำกับ (เช่น "ก.ย. 2569")</label>
              <input
                value={entryForm.period_label}
                onChange={(e) => setEntryForm({ ...entryForm, period_label: e.target.value })}
                placeholder="ไม่กรอกจะใช้วันที่แทน"
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>
          </div>

          <label style={{ display: 'block', fontSize: '13px', marginBottom: '8px', fontWeight: 600 }}>ค่าพลังงานแต่ละประเภท</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', marginBottom: '12px' }}>
            {energyTypes.map((t) => (
              <div key={t.id}>
                <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>{t.energy_name} ({t.unit})</label>
                <input
                  type="number"
                  step="any"
                  value={entryForm.values[t.id] ?? ''}
                  onChange={(e) =>
                    setEntryForm({ ...entryForm, values: { ...entryForm.values, [t.id]: e.target.value } })
                  }
                  placeholder="0"
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>
            ))}
          </div>

          <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>หมายเหตุ (ถ้ามี)</label>
          <input
            value={entryForm.note}
            onChange={(e) => setEntryForm({ ...entryForm, note: e.target.value })}
            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '16px' }}
          />

          <button type="submit" disabled={saving} style={{ padding: '10px 20px', borderRadius: '6px', border: 'none', background: '#3b82f6', color: 'white', fontWeight: 600, cursor: 'pointer' }}>
            {saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
          </button>
        </form>
      </div>

      {/* ตารางข้อมูลล่าสุด */}
      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px' }}>
        <h3 style={{ marginTop: 0 }}>ข้อมูลล่าสุด (20 รายการ)</h3>
        {loading ? (
          <p>กำลังโหลด...</p>
        ) : entries.length === 0 ? (
          <p style={{ color: '#94a3b8' }}>ยังไม่มีข้อมูล</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '8px' }}>วันที่</th>
                <th style={{ padding: '8px' }}>ช่วง</th>
                <th style={{ padding: '8px' }}>ป้ายกำกับ</th>
                <th style={{ padding: '8px' }}>ค่าพลังงาน</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px' }}>{e.record_date}</td>
                  <td style={{ padding: '8px' }}>{e.period_type === 'monthly' ? 'รายเดือน' : 'รายปี'}</td>
                  <td style={{ padding: '8px' }}>{e.period_label}</td>
                  <td style={{ padding: '8px' }}>
                    {(e.energy_values || [])
                      .map((v) => `${v.energy_types?.energy_name}: ${v.value}${v.energy_types?.unit}`)
                      .join(', ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
