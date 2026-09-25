'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function EnergyDataPage() {
  const [energyTypes, setEnergyTypes] = useState([]);
  const [entries, setEntries] = useState([]);
  const [viewMode, setViewMode] = useState('monthly'); // 'monthly' | 'yearly'
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddTypeForm, setShowAddTypeForm] = useState(false);
  const [showAddEntryForm, setShowAddEntryForm] = useState(false);
  const [editingId, setEditingId] = useState(null); // id ของ energy_data ที่กำลังแก้ไข

  const [typeForm, setTypeForm] = useState({ name: '', unit: '' });

  const emptyEntryForm = {
    record_date: new Date().toISOString().slice(0, 10),
    period_type: 'monthly',
    period_label: '',
    note: '',
    values: {},
  };
  const [entryForm, setEntryForm] = useState(emptyEntryForm);
  const [editForm, setEditForm] = useState(emptyEntryForm);

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
        energy_values ( value, energy_type_id, energy_types ( energy_name, unit ) )
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

  // ---------- เพิ่มข้อมูลใหม่ ----------
  async function handleAddEntry(e) {
    e.preventDefault();
    setSaving(true);

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

    const valueRows = energyTypes
      .filter((t) => entryForm.values[t.id] !== undefined && entryForm.values[t.id] !== '')
      .map((t) => ({
        energy_data_id: dataRow.id,
        energy_type_id: t.id,
        value: Number(entryForm.values[t.id]),
      }));

    if (valueRows.length > 0) {
      const { error: valuesError } = await supabase.from('energy_values').insert(valueRows);
      if (valuesError) alert('บันทึกค่าพลังงานไม่สำเร็จ: ' + valuesError.message);
    }

    setSaving(false);
    setEntryForm(emptyEntryForm);
    setShowAddEntryForm(false);
    if (entryForm.period_type === viewMode) fetchEntries();
  }

  // ---------- เริ่มแก้ไขแถวที่มีอยู่ ----------
  function startEdit(entry) {
    const values = {};
    (entry.energy_values || []).forEach((v) => {
      values[v.energy_type_id] = v.value;
    });

    setEditForm({
      record_date: entry.record_date,
      period_type: entry.period_type,
      period_label: entry.period_label || '',
      note: entry.note || '',
      values,
    });
    setEditingId(entry.id);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(emptyEntryForm);
  }

  // ---------- บันทึกการแก้ไข ----------
  async function handleUpdateEntry(e) {
    e.preventDefault();
    if (!editingId) return;

    setSaving(true);

    // 1) อัปเดตแถวหลักใน energy_data
    const { error: updateError } = await supabase
      .from('energy_data')
      .update({
        record_date: editForm.record_date,
        period_label: editForm.period_label || editForm.record_date,
        note: editForm.note || null,
      })
      .eq('id', editingId);

    if (updateError) {
      setSaving(false);
      alert('แก้ไขไม่สำเร็จ: ' + updateError.message);
      return;
    }

    // 2) ลบค่าพลังงานเดิมทั้งหมดของแถวนี้ แล้วใส่ค่าใหม่แทน (ง่ายและชัวร์กว่า upsert ทีละตัว)
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

    setSaving(false);
    cancelEdit();
    fetchEntries();
  }

  async function handleDeleteEntry(id) {
    if (!confirm('ลบข้อมูลนี้ใช่ไหม?')) return;
    await supabase.from('energy_values').delete().eq('energy_data_id', id);
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

      {/* Toggle รายเดือน/รายปี + ปุ่มเพิ่มข้อมูล */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
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

        <button
          onClick={() => {
            setEntryForm({ ...emptyEntryForm, period_type: viewMode });
            setShowAddEntryForm((v) => !v);
          }}
          style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 18px', fontWeight: 600, cursor: 'pointer' }}
        >
          {showAddEntryForm ? 'ยกเลิก' : '+ เพิ่มข้อมูล'}
        </button>
      </div>

      {/* ฟอร์มเพิ่มข้อมูลใหม่ */}
      {showAddEntryForm && (
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
          <EntryFields form={entryForm} setForm={setEntryForm} energyTypes={energyTypes} />
          <button onClick={handleAddEntry} disabled={saving} style={{ marginTop: '12px', padding: '10px 20px', borderRadius: '6px', border: 'none', background: '#3b82f6', color: 'white', fontWeight: 600, cursor: 'pointer' }}>
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
                <th style={{ padding: '8px' }}>วันที่</th>
                <th style={{ padding: '8px' }}>ป้ายกำกับ</th>
                <th style={{ padding: '8px' }}>ค่าพลังงาน</th>
                <th style={{ padding: '8px' }}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) =>
                editingId === entry.id ? (
                  <tr key={entry.id}>
                    <td colSpan={4} style={{ padding: '12px', background: '#f8fafc' }}>
                      <EntryFields form={editForm} setForm={setEditForm} energyTypes={energyTypes} hidePeriodType />
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
                    <td style={{ padding: '8px' }}>{entry.record_date}</td>
                    <td style={{ padding: '8px' }}>{entry.period_label}</td>
                    <td style={{ padding: '8px' }}>
                      {(entry.energy_values || [])
                        .map((v) => `${v.energy_types?.energy_name}: ${v.value}${v.energy_types?.unit}`)
                        .join(', ')}
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

// ฟอร์มย่อยที่ใช้ร่วมกันทั้งตอนเพิ่มและตอนแก้ไข
function EntryFields({ form, setForm, energyTypes, hidePeriodType }) {
  return (
    <>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '140px' }}>
          <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>วันที่บันทึก</label>
          <input
            type="date"
            value={form.record_date}
            onChange={(e) => setForm({ ...form, record_date: e.target.value })}
            required
            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
          />
        </div>

        {!hidePeriodType && (
          <div style={{ flex: 1, minWidth: '140px' }}>
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
        )}

        <div style={{ flex: 1, minWidth: '140px' }}>
          <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>ป้ายกำกับ</label>
          <input
            value={form.period_label}
            onChange={(e) => setForm({ ...form, period_label: e.target.value })}
            placeholder='เช่น "ก.ย. 2569"'
            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
          />
        </div>
      </div>

      <label style={{ display: 'block', fontSize: '13px', marginBottom: '8px', fontWeight: 600 }}>ค่าพลังงานแต่ละประเภท</label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px', marginBottom: '12px' }}>
        {energyTypes.map((t) => (
          <div key={t.id}>
            <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>{t.energy_name} ({t.unit})</label>
            <input
              type="number"
              step="any"
              value={form.values[t.id] ?? ''}
              onChange={(e) => setForm({ ...form, values: { ...form.values, [t.id]: e.target.value } })}
              placeholder="0"
              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
          </div>
        ))}
      </div>

      <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>หมายเหตุ (ถ้ามี)</label>
      <input
        value={form.note}
        onChange={(e) => setForm({ ...form, note: e.target.value })}
        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
      />
    </>
  );
}
