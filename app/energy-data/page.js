'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

// รายชื่อระบบไฟฟ้าย่อย (ชื่อภาษาอังกฤษไว้ใช้แสดงในกราฟ Dashboard)
const ELECTRICITY_SYSTEMS = [
  { key: 'cooling', name: 'Cooling System' },
  { key: 'lighting', name: 'Lighting System' },
  { key: 'production', name: 'Production System' },
  { key: 'air_conditioning', name: 'Air Conditioning System' },
  { key: 'others', name: 'Others' },
];

const MONTH_NAMES = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 11 }, (_, i) => CURRENT_YEAR - 5 + i);

// สร้าง record_date + period_label จาก period_type/month/year
function buildDateLabel(period_type, month, year) {
  if (period_type === 'yearly') {
    return { record_date: `${year}-01-01`, period_label: `ปี ${year}` };
  }
  const mm = String(month).padStart(2, '0');
  return { record_date: `${year}-${mm}-01`, period_label: `${MONTH_NAMES[month - 1]} ${year}` };
}

const emptyEnergyForm = {
  period_type: 'monthly',
  month: new Date().getMonth() + 1,
  year: CURRENT_YEAR,
  note: '',
  values: {},
};

const emptyBreakdownForm = {
  period_type: 'monthly',
  month: new Date().getMonth() + 1,
  year: CURRENT_YEAR,
  note: '',
  breakdown: Object.fromEntries(ELECTRICITY_SYSTEMS.map((s) => [s.key, ''])),
};

export default function EnergyDataPage() {
  const [energyTypes, setEnergyTypes] = useState([]);
  const [entries, setEntries] = useState([]);
  const [viewMode, setViewMode] = useState('monthly'); // 'monthly' | 'yearly' — ใช้กรองตารางรายการด้านล่าง
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddTypeForm, setShowAddTypeForm] = useState(false);
  const [showEnergyForm, setShowEnergyForm] = useState(false);
  const [showBreakdownForm, setShowBreakdownForm] = useState(false);
  const [editingId, setEditingId] = useState(null); // id ของ energy_data ที่กำลังแก้ไข

  const [typeForm, setTypeForm] = useState({ name: '', unit: '' });
  const [energyForm, setEnergyForm] = useState(emptyEnergyForm);
  const [breakdownForm, setBreakdownForm] = useState(emptyBreakdownForm);
  const [editForm, setEditForm] = useState({ ...emptyEnergyForm, breakdown: emptyBreakdownForm.breakdown });

  useEffect(() => {
    fetchEnergyTypes();
  }, []);

  useEffect(() => {
    fetchEntries();
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

  async function fetchEntries() {
    setLoading(true);
    const { data, error } = await supabase
      .from('energy_data')
      .select(`
        id, record_date, period_type, period_label, note,
        energy_values ( value, energy_type_id, energy_types ( energy_name, unit ) ),
        electricity_breakdown ( system_key, value )
      `)
      .eq('period_type', viewMode)
      .order('record_date', { ascending: false });

    if (!error) setEntries(data || []);
    setLoading(false);
  }

  // ---------- เพิ่มประเภทพลังงาน ----------
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

  // ---------- เพิ่มค่าพลังงาน (ไฟฟ้า/LPG/Biogas/Generator) ----------
  async function handleAddEnergyEntry(e) {
    e.preventDefault();
    setSaving(true);

    const { record_date, period_label } = buildDateLabel(energyForm.period_type, energyForm.month, energyForm.year);

    const { data: dataRow, error: dataError } = await supabase
      .from('energy_data')
      .insert({
        record_date,
        period_type: energyForm.period_type,
        period_label,
        note: energyForm.note || null,
      })
      .select()
      .single();

    if (dataError || !dataRow) {
      setSaving(false);
      alert('บันทึกข้อมูลไม่สำเร็จ: ' + dataError?.message);
      return;
    }

    const valueRows = energyTypes
      .filter((t) => energyForm.values[t.id] !== undefined && energyForm.values[t.id] !== '')
      .map((t) => ({
        energy_data_id: dataRow.id,
        energy_type_id: t.id,
        value: Number(energyForm.values[t.id]),
      }));

    if (valueRows.length > 0) {
      const { error: valuesError } = await supabase.from('energy_values').insert(valueRows);
      if (valuesError) alert('บันทึกค่าพลังงานไม่สำเร็จ: ' + valuesError.message);
    }

    setSaving(false);

    // รายเดือน: เลื่อน dropdown ไปเดือนถัดไปอัตโนมัติ (ปีเดิม) เพื่อกรอกต่อได้ทันที จนสุดที่ธันวาคม
    // ปีจะไม่เปลี่ยนเองจนกว่าผู้ใช้จะไปเลือกปีใหม่ด้วยตัวเอง
    if (energyForm.period_type === 'monthly' && energyForm.month < 12) {
      setEnergyForm({ ...emptyEnergyForm, month: energyForm.month + 1, year: energyForm.year });
    } else {
      setEnergyForm({ ...emptyEnergyForm, period_type: energyForm.period_type, year: energyForm.year });
    }

    if (energyForm.period_type === viewMode) fetchEntries();
  }

  // ---------- เพิ่มสัดส่วนไฟฟ้าตามระบบ ----------
  async function handleAddBreakdownEntry(e) {
    e.preventDefault();
    setSaving(true);

    const { record_date, period_label } = buildDateLabel(breakdownForm.period_type, breakdownForm.month, breakdownForm.year);

    const { data: dataRow, error: dataError } = await supabase
      .from('energy_data')
      .insert({
        record_date,
        period_type: breakdownForm.period_type,
        period_label,
        note: breakdownForm.note || null,
      })
      .select()
      .single();

    if (dataError || !dataRow) {
      setSaving(false);
      alert('บันทึกข้อมูลไม่สำเร็จ: ' + dataError?.message);
      return;
    }

    const breakdownRows = ELECTRICITY_SYSTEMS
      .filter((s) => breakdownForm.breakdown[s.key] !== undefined && breakdownForm.breakdown[s.key] !== '')
      .map((s) => ({
        energy_data_id: dataRow.id,
        system_key: s.key,
        value: Number(breakdownForm.breakdown[s.key]),
      }));

    if (breakdownRows.length > 0) {
      const { error: breakdownError } = await supabase.from('electricity_breakdown').insert(breakdownRows);
      if (breakdownError) alert('บันทึกสัดส่วนไฟฟ้าไม่สำเร็จ: ' + breakdownError.message);
    }

    setSaving(false);

    if (breakdownForm.period_type === 'monthly' && breakdownForm.month < 12) {
      setBreakdownForm({ ...emptyBreakdownForm, month: breakdownForm.month + 1, year: breakdownForm.year });
    } else {
      setBreakdownForm({ ...emptyBreakdownForm, period_type: breakdownForm.period_type, year: breakdownForm.year });
    }

    if (breakdownForm.period_type === viewMode) fetchEntries();
  }

  // ---------- เริ่มแก้ไขแถวที่มีอยู่ (แก้ได้ทั้งค่าพลังงานและสัดส่วนไฟฟ้าในที่เดียว) ----------
  function startEdit(entry) {
    const d = new Date(entry.record_date);

    const values = {};
    (entry.energy_values || []).forEach((v) => {
      values[v.energy_type_id] = v.value;
    });

    const breakdown = Object.fromEntries(ELECTRICITY_SYSTEMS.map((s) => [s.key, '']));
    (entry.electricity_breakdown || []).forEach((b) => {
      breakdown[b.system_key] = b.value;
    });

    setEditForm({
      period_type: entry.period_type,
      month: d.getMonth() + 1,
      year: d.getFullYear(),
      note: entry.note || '',
      values,
      breakdown,
    });
    setEditingId(entry.id);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm({ ...emptyEnergyForm, breakdown: emptyBreakdownForm.breakdown });
  }

  // ---------- บันทึกการแก้ไข ----------
  async function handleUpdateEntry(e) {
    e.preventDefault();
    if (!editingId) return;

    setSaving(true);

    const { record_date, period_label } = buildDateLabel(editForm.period_type, editForm.month, editForm.year);

    // 1) อัปเดตแถวหลักใน energy_data
    const { error: updateError } = await supabase
      .from('energy_data')
      .update({
        record_date,
        period_label,
        note: editForm.note || null,
      })
      .eq('id', editingId);

    if (updateError) {
      setSaving(false);
      alert('แก้ไขไม่สำเร็จ: ' + updateError.message);
      return;
    }

    // 2) ลบค่าพลังงานเดิมทั้งหมดของแถวนี้ แล้วใส่ค่าใหม่แทน
    await supabase.from('energy_values').delete().eq('energy_data_id', editingId);

    const valueRows = energyTypes
      .filter((t) => editForm.values[t.id] !== undefined && editForm.values[t.id] !== '')
      .map((t) => ({
        energy_data_id: editingId,
        energy_type_id: t.id,
        value: Number(editForm.values[t.id]),
      }));

    if (valueRows.length > 0) {
      const { error: valuesError } = await supabase.from('energy_values').insert(valueRows);
      if (valuesError) alert('แก้ไขค่าพลังงานไม่สำเร็จ: ' + valuesError.message);
    }

    // 3) ลบ+ใส่สัดส่วนไฟฟ้าใหม่ ด้วยหลักการเดียวกัน
    await supabase.from('electricity_breakdown').delete().eq('energy_data_id', editingId);

    const breakdownRows = ELECTRICITY_SYSTEMS
      .filter((s) => editForm.breakdown[s.key] !== undefined && editForm.breakdown[s.key] !== '')
      .map((s) => ({
        energy_data_id: editingId,
        system_key: s.key,
        value: Number(editForm.breakdown[s.key]),
      }));

    if (breakdownRows.length > 0) {
      const { error: breakdownError } = await supabase.from('electricity_breakdown').insert(breakdownRows);
      if (breakdownError) alert('แก้ไขสัดส่วนไฟฟ้าไม่สำเร็จ: ' + breakdownError.message);
    }

    setSaving(false);
    cancelEdit();
    fetchEntries();
  }

  async function handleDeleteEntry(id) {
    if (!confirm('ลบข้อมูลนี้ใช่ไหม?')) return;
    await supabase.from('energy_values').delete().eq('energy_data_id', id);
    await supabase.from('electricity_breakdown').delete().eq('energy_data_id', id);
    await supabase.from('energy_data').delete().eq('id', id);
    fetchEntries();
  }

  return (
    <div style={{ padding: '32px', maxWidth: '1000px' }}>
      <h1 style={{ fontSize: '26px', fontWeight: 700 }}>📋 Energy Data</h1>
      <p style={{ color: '#64748b', marginTop: '-8px' }}>จัดการประเภทพลังงานและข้อมูลการใช้พลังงานแต่ละงวด</p>

      {/* ประเภทพลังงาน + ปุ่มเพิ่ม */}
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

      {/* Toggle รายเดือน/รายปี ของตารางด้านล่าง + ปุ่มเพิ่มข้อมูล 2 ปุ่มแยกกัน */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
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

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setShowEnergyForm((v) => !v)}
            style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 18px', fontWeight: 600, cursor: 'pointer' }}
          >
            {showEnergyForm ? 'ยกเลิก' : '+ เพิ่มค่าพลังงาน'}
          </button>
          <button
            onClick={() => setShowBreakdownForm((v) => !v)}
            style={{ background: '#a855f7', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 18px', fontWeight: 600, cursor: 'pointer' }}
          >
            {showBreakdownForm ? 'ยกเลิก' : '+ เพิ่มสัดส่วนไฟฟ้า'}
          </button>
        </div>
      </div>

      {/* ฟอร์มเพิ่มค่าพลังงาน */}
      {showEnergyForm && (
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
          <h4 style={{ marginTop: 0 }}>เพิ่มค่าพลังงาน</h4>
          <MonthYearSelector form={energyForm} setForm={setEnergyForm} />

          <label style={{ display: 'block', fontSize: '13px', marginBottom: '8px', fontWeight: 600 }}>ค่าพลังงานแต่ละประเภท</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px', marginBottom: '12px' }}>
            {energyTypes.map((t) => (
              <div key={t.id}>
                <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>{t.energy_name} ({t.unit})</label>
                <input
                  type="number"
                  step="any"
                  value={energyForm.values[t.id] ?? ''}
                  onChange={(e) => setEnergyForm({ ...energyForm, values: { ...energyForm.values, [t.id]: e.target.value } })}
                  placeholder="0"
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>
            ))}
          </div>

          <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>หมายเหตุ (ถ้ามี)</label>
          <input
            value={energyForm.note}
            onChange={(e) => setEnergyForm({ ...energyForm, note: e.target.value })}
            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '12px' }}
          />

          {energyForm.period_type === 'monthly' && (
            <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '-4px' }}>
              บันทึกแล้วระบบจะเลื่อนไปเดือนถัดไปให้อัตโนมัติ (ปีเดิม) เพื่อกรอกต่อเนื่องได้ทันที
            </p>
          )}

          <button onClick={handleAddEnergyEntry} disabled={saving} style={{ padding: '10px 20px', borderRadius: '6px', border: 'none', background: '#3b82f6', color: 'white', fontWeight: 600, cursor: 'pointer' }}>
            {saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
          </button>
        </div>
      )}

      {/* ฟอร์มเพิ่มสัดส่วนไฟฟ้าตามระบบ */}
      {showBreakdownForm && (
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
          <h4 style={{ marginTop: 0 }}>เพิ่มสัดส่วนการใช้ไฟฟ้าตามระบบ</h4>
          <MonthYearSelector form={breakdownForm} setForm={setBreakdownForm} />

          <label style={{ display: 'block', fontSize: '13px', marginBottom: '8px', fontWeight: 600 }}>สัดส่วนการใช้ไฟฟ้าตามระบบ (kWh)</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px', marginBottom: '12px' }}>
            {ELECTRICITY_SYSTEMS.map((s) => (
              <div key={s.key}>
                <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>{s.name}</label>
                <input
                  type="number"
                  step="any"
                  value={breakdownForm.breakdown[s.key] ?? ''}
                  onChange={(e) => setBreakdownForm({ ...breakdownForm, breakdown: { ...breakdownForm.breakdown, [s.key]: e.target.value } })}
                  placeholder="0"
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>
            ))}
          </div>

          <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>หมายเหตุ (ถ้ามี)</label>
          <input
            value={breakdownForm.note}
            onChange={(e) => setBreakdownForm({ ...breakdownForm, note: e.target.value })}
            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '12px' }}
          />

          {breakdownForm.period_type === 'monthly' && (
            <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '-4px' }}>
              บันทึกแล้วระบบจะเลื่อนไปเดือนถัดไปให้อัตโนมัติ (ปีเดิม) เพื่อกรอกต่อเนื่องได้ทันที
            </p>
          )}

          <button onClick={handleAddBreakdownEntry} disabled={saving} style={{ padding: '10px 20px', borderRadius: '6px', border: 'none', background: '#a855f7', color: 'white', fontWeight: 600, cursor: 'pointer' }}>
            {saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
          </button>
        </div>
      )}

      {/* ตารางข้อมูล */}
      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px' }}>
        <h3 style={{ marginTop: 0 }}>
          ข้อมูล{viewMode === 'monthly' ? 'รายเดือน' : 'รายปี'} ({entries.length} รายการ)
        </h3>

        {loading ? (
          <p>กำลังโหลด...</p>
        ) : entries.length === 0 ? (
          <p style={{ color: '#94a3b8' }}>ยังไม่มีข้อมูล</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '8px' }}>ช่วงเวลา</th>
                <th style={{ padding: '8px' }}>ค่าพลังงาน</th>
                <th style={{ padding: '8px' }}>สัดส่วนไฟฟ้าตามระบบ</th>
                <th style={{ padding: '8px' }}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) =>
                editingId === entry.id ? (
                  <tr key={entry.id}>
                    <td colSpan={4} style={{ padding: '12px', background: '#f8fafc' }}>
                      <MonthYearSelector form={editForm} setForm={setEditForm} />

                      <label style={{ display: 'block', fontSize: '13px', marginBottom: '8px', fontWeight: 600 }}>ค่าพลังงานแต่ละประเภท</label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                        {energyTypes.map((t) => (
                          <div key={t.id}>
                            <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>{t.energy_name} ({t.unit})</label>
                            <input
                              type="number"
                              step="any"
                              value={editForm.values[t.id] ?? ''}
                              onChange={(e) => setEditForm({ ...editForm, values: { ...editForm.values, [t.id]: e.target.value } })}
                              placeholder="0"
                              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                            />
                          </div>
                        ))}
                      </div>

                      <label style={{ display: 'block', fontSize: '13px', marginBottom: '8px', fontWeight: 600 }}>สัดส่วนการใช้ไฟฟ้าตามระบบ (kWh)</label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                        {ELECTRICITY_SYSTEMS.map((s) => (
                          <div key={s.key}>
                            <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>{s.name}</label>
                            <input
                              type="number"
                              step="any"
                              value={editForm.breakdown[s.key] ?? ''}
                              onChange={(e) => setEditForm({ ...editForm, breakdown: { ...editForm.breakdown, [s.key]: e.target.value } })}
                              placeholder="0"
                              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                            />
                          </div>
                        ))}
                      </div>

                      <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>หมายเหตุ (ถ้ามี)</label>
                      <input
                        value={editForm.note}
                        onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      />

                      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                        <button onClick={handleUpdateEntry} disabled={saving} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#22c55e', color: 'white', cursor: 'pointer' }}>
                          {saving ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
                        </button>
                        <button onClick={cancelEdit} type="button" style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer' }}>
                          ยกเลิก
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={entry.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px' }}>{entry.period_label || entry.record_date}</td>
                    <td style={{ padding: '8px' }}>
                      {(entry.energy_values || []).length > 0
                        ? entry.energy_values.map((v) => `${v.energy_types?.energy_name}: ${v.value}${v.energy_types?.unit}`).join(', ')
                        : '-'}
                    </td>
                    <td style={{ padding: '8px' }}>
                      {(entry.electricity_breakdown || []).length > 0
                        ? entry.electricity_breakdown
                            .map((b) => {
                              const sys = ELECTRICITY_SYSTEMS.find((s) => s.key === b.system_key);
                              return `${sys ? sys.name : b.system_key}: ${b.value}kWh`;
                            })
                            .join(', ')
                        : '-'}
                    </td>
                    <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>
                      <button onClick={() => startEdit(entry)} style={{ marginRight: '8px', padding: '4px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer' }}>
                        แก้ไข
                      </button>
                      <button onClick={() => handleDeleteEntry(entry.id)} style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #fecaca', background: 'white', color: '#ef4444', cursor: 'pointer' }}>
                        ลบ
                      </button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// dropdown เลือกประเภทช่วงเวลา + เดือน (ถ้าเป็นรายเดือน) + ปี — ใช้ร่วมกันทั้ง 3 ฟอร์ม
function MonthYearSelector({ form, setForm }) {
  return (
    <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
      <div style={{ minWidth: '140px' }}>
        <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>ประเภทช่วงเวลา</label>
        <select
          value={form.period_type}
          onChange={(e) => setForm({ ...form, period_type: e.target.value })}
          style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
        >
          <option value="monthly">รายเดือน</option>
          <option value="yearly">รายปี</option>
        </select>
      </div>

      {form.period_type === 'monthly' && (
        <div style={{ minWidth: '140px' }}>
          <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>เดือน</label>
          <select
            value={form.month}
            onChange={(e) => setForm({ ...form, month: Number(e.target.value) })}
            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
          >
            {MONTH_NAMES.map((name, i) => (
              <option key={i} value={i + 1}>{name}</option>
            ))}
          </select>
        </div>
      )}

      <div style={{ minWidth: '140px' }}>
        <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>ปี</label>
        <select
          value={form.year}
          onChange={(e) => setForm({ ...form, year: Number(e.target.value) })}
          style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
        >
          {YEAR_OPTIONS.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
