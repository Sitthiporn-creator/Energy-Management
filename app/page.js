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
  LabelList,
} from 'recharts';

const PALETTE = [
  '#3b82f6',
  '#ef4444',
  '#22c55e',
  '#f59e0b',
  '#a855f7',
  '#06b6d4',
  '#ec4899',
  '#64748b',
];

const ELECTRICITY_SYSTEMS = [
  {
    key: 'cooling',
    name: 'Cooling System',
    color: '#3b82f6',
  },
  {
    key: 'lighting',
    name: 'Lighting System',
    color: '#f59e0b',
  },
  {
    key: 'production',
    name: 'Production System',
    color: '#22c55e',
  },
  {
    key: 'air_conditioning',
    name: 'Air Conditioning System',
    color: '#a855f7',
  },
  {
    key: 'others',
    name: 'Others',
    color: '#64748b',
  },
];

const MONTH_NAMES = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
];

const CURRENT_YEAR = new Date().getFullYear();

const YEAR_OPTIONS = Array.from(
  { length: 11 },
  (_, i) => CURRENT_YEAR - 5 + i
);

function periodToDate(periodType, month, year) {
  if (periodType === 'yearly') {
    return `${year}-01-01`;
  }

  return `${year}-${String(month).padStart(2, '0')}-01`;
}

function periodToLabel(periodType, month, year) {
  if (periodType === 'yearly') {
    return `ปี ${year}`;
  }

  return `${MONTH_NAMES[month - 1]} ${year}`;
}

// ป้าย % การเปลี่ยนแปลง
function ChangeBarLabel({
  x,
  y,
  width,
  index,
  series,
}) {
  if (!series || index === 0) {
    return null;
  }

  const cur =
    series[index]?.value ?? 0;

  const prev =
    series[index - 1]?.value ?? 0;

  const diff = cur - prev;

  if (diff === 0) {
    return null;
  }

  const percent =
    prev === 0
      ? 100
      : (diff / prev) * 100;

  const color =
    diff > 0
      ? '#16a34a'
      : '#dc2626';

  const arrow =
    diff > 0
      ? '▲'
      : '▼';

  return (
    <text
      x={x + width / 2}
      y={y - 8}
      textAnchor="middle"
      fontSize={11}
      fontWeight={700}
      fill={color}
    >
      {arrow} {Math.abs(percent).toFixed(1)}%
    </text>
  );
}

export default function DashboardPage() {
  const [energyTypes, setEnergyTypes] =
    useState([]);

  const [records, setRecords] =
    useState([]);

  const [breakdown, setBreakdown] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [periodType, setPeriodType] =
    useState('monthly');

  const [pickMonth, setPickMonth] =
    useState(
      new Date().getMonth() + 1
    );

  const [pickYear, setPickYear] =
    useState(CURRENT_YEAR);

  const [selected, setSelected] =
    useState({
      monthly: [
        {
          month:
            new Date().getMonth() + 1,
          year: CURRENT_YEAR,
        },
      ],
      yearly: [
        {
          year: CURRENT_YEAR,
        },
      ],
    });

  const currentSelection =
    selected[periodType];

  const [
    expandedTypeId,
    setExpandedTypeId,
  ] = useState(null);

  useEffect(() => {
    fetchEnergyTypes();
  }, []);

  useEffect(() => {
    fetchRecords();
    fetchBreakdown();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodType, selected]);

  async function fetchEnergyTypes() {
    const {
      data,
      error,
    } = await supabase
      .from('energy_types')
      .select('*')
      .eq('is_active', true)
      .order('id', {
        ascending: true,
      });

    if (!error) {
      setEnergyTypes(data || []);
    } else {
      console.error(
        'fetchEnergyTypes error:',
        error
      );
    }
  }

  function selectedDates() {
    return currentSelection.map(
      (p) =>
        periodType === 'yearly'
          ? periodToDate(
              'yearly',
              null,
              p.year
            )
          : periodToDate(
              'monthly',
              p.month,
              p.year
            )
    );
  }

  async function fetchRecords() {
    const dates =
      selectedDates();

    if (dates.length === 0) {
      setRecords([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const {
      data,
      error,
    } = await supabase
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
          energy_types (
            energy_name,
            energy_key,
            unit
          )
        )
      `)
      .eq(
        'period_type',
        periodType
      )
      .in(
        'record_date',
        dates
      )
      .order(
        'record_date',
        {
          ascending: true,
        }
      );

    if (!error) {
      setRecords(data || []);
    } else {
      console.error(
        'fetchRecords error:',
        error
      );
      setRecords([]);
    }

    setLoading(false);
  }

  async function fetchBreakdown() {
    const dates =
      selectedDates();

    if (dates.length === 0) {
      setBreakdown([]);
      return;
    }

    const {
      data,
      error,
    } = await supabase
      .from(
        'electricity_breakdown'
      )
      .select(
        'system_key, value, energy_data!inner(record_date, period_type)'
      )
      .eq(
        'energy_data.period_type',
        periodType
      )
      .in(
        'energy_data.record_date',
        dates
      );

    if (error) {
      console.error(
        'fetchBreakdown error:',
        error
      );

      setBreakdown([]);
      return;
    }

    const totals = {};

    ELECTRICITY_SYSTEMS.forEach(
      (s) => {
        totals[s.key] = 0;
      }
    );

    (data || []).forEach(
      (row) => {
        if (
          totals[row.system_key] !==
          undefined
        ) {
          totals[row.system_key] +=
            Number(
              row.value || 0
            );
        }
      }
    );

    setBreakdown(
      ELECTRICITY_SYSTEMS.map(
        (s) => ({
          ...s,
          value:
            totals[s.key],
        })
      )
    );
  }

  /*
   * ข้อมูลพื้นฐานสำหรับรายปี
   */
  function buildChartData() {
    return records.map(
      (r) => {
        const row = {
          key:
            r.period_label ||
            r.record_date,
        };

        (
          r.energy_values || []
        ).forEach(
          (v) => {
            const typeName =
              v.energy_types
                ?.energy_name ||
              'ไม่ทราบ';

            row[typeName] =
              Number(
                v.value || 0
              );
          }
        );

        return row;
      }
    );
  }

  /*
   * =========================================================
   * กราฟรายเดือน
   *
   * ตัวอย่างเลือก:
   *
   * ม.ค. 2568
   * ม.ค. 2569
   * ก.พ. 2568
   * ก.พ. 2569
   *
   * จะกลายเป็น:
   *
   *        ม.ค.              ก.พ.
   *       ███ ███           ███ ███
   *       ███ ███           ███ ███
   *
   *       2568 2569         2568 2569
   *
   * โดยชื่อเดือนจะไม่ซ้ำ
   * =========================================================
   */
  function typeSeries(t) {
    /*
     * รายปี
     */
    if (periodType !== 'monthly') {
      return chartData.map(
        (row) => ({
          key: row.key,
          value: Number(
            row[t.energy_name] || 0
          ),
        })
      );
    }

    /*
     * ปีทั้งหมดที่เลือก
     */
    const years = [
      ...new Set(
        currentSelection.map(
          (p) =>
            Number(p.year)
        )
      ),
    ].sort(
      (a, b) => a - b
    );

    /*
     * เก็บข้อมูลโดยใช้เดือนเป็น key
     */
    const monthRows =
      new Map();

    /*
     * วนข้อมูลจาก Supabase
     */
    records.forEach(
      (record) => {
        const date =
          String(
            record.record_date ||
              ''
          );

        /*
         * รองรับทั้ง
         * 2025-01-01
         * และ timestamp
         */
        const datePart =
          date.split('T')[0];

        const parts =
          datePart.split('-');

        if (
          parts.length < 2
        ) {
          return;
        }

        const year =
          Number(parts[0]);

        const month =
          Number(parts[1]);

        if (
          !year ||
          !month ||
          month < 1 ||
          month > 12
        ) {
          return;
        }

        /*
         * สำคัญ:
         * เทียบ id ด้วย String
         * เพื่อป้องกัน number/string ไม่ตรงกัน
         */
        const valueRow =
          (
            record.energy_values ||
            []
          ).find(
            (v) =>
              String(
                v.energy_type_id
              ) ===
              String(t.id)
          );

        /*
         * ถ้าหา id ไม่เจอ
         * ลองหาโดย energy_key / energy_name
         */
        let value = null;

        if (valueRow) {
          value =
            Number(
              valueRow.value || 0
            );
        }

        if (
          value === null
        ) {
          const fallbackRow =
            (
              record.energy_values ||
              []
            ).find(
              (v) => {
                const rowType =
                  v.energy_types;

                if (!rowType) {
                  return false;
                }

                return (
                  rowType.energy_key ===
                    t.energy_key ||
                  rowType.energy_name ===
                    t.energy_name
                );
              }
            );

          if (fallbackRow) {
            value =
              Number(
                fallbackRow.value ||
                  0
              );
          }
        }

        if (
          value === null
        ) {
          value = 0;
        }

        /*
         * ถ้ายังไม่มีเดือนนี้
         * ให้สร้าง row
         */
        if (
          !monthRows.has(
            month
          )
        ) {
          const row = {
            month,
            key:
              MONTH_NAMES[
                month - 1
              ],
          };

          /*
           * สร้างช่องของทุกปี
           */
          years.forEach(
            (year) => {
              row[
                `year_${year}`
              ] = 0;
            }
          );

          monthRows.set(
            month,
            row
          );
        }

        /*
         * ใส่ค่าของปีนั้น
         */
        monthRows.get(
          month
        )[
          `year_${year}`
        ] = value;
      }
    );

    /*
     * ถ้ามีการเลือกเดือน
     * แต่ไม่มี record ในเดือนนั้น
     * ให้สร้างเดือนนั้นขึ้นมาด้วย
     *
     * เพื่อให้แกน X ไม่หาย
     */
    currentSelection.forEach(
      (selection) => {
        const month =
          Number(
            selection.month
          );

        const year =
          Number(
            selection.year
          );

        if (
          !month ||
          !year
        ) {
          return;
        }

        if (
          !monthRows.has(
            month
          )
        ) {
          const row = {
            month,
            key:
              MONTH_NAMES[
                month - 1
              ],
          };

          years.forEach(
            (y) => {
              row[
                `year_${y}`
              ] = 0;
            }
          );

          monthRows.set(
            month,
            row
          );
        }
      }
    );

    /*
     * เรียง ม.ค. -> ธ.ค.
     */
    return [
      ...monthRows.values(),
    ].sort(
      (a, b) =>
        a.month -
        b.month
    );
  }

  /*
   * ปีที่เลือก
   */
  function chartYears() {
    return [
      ...new Set(
        currentSelection.map(
          (p) =>
            Number(p.year)
        )
      ),
    ].sort(
      (a, b) =>
        a - b
    );
  }

  /*
   * Series สำหรับคำนวณ %
   */
  function yearSeries(
    series,
    year
  ) {
    const key =
      `year_${year}`;

    return series.map(
      (row) => ({
        key: row.key,
        value: Number(
          row[key] || 0
        ),
      })
    );
  }

  /*
   * รวมค่าพลังงาน
   */
  function totalForType(
    typeId
  ) {
    return records.reduce(
      (
        sum,
        r
      ) => {
        const match =
          (
            r.energy_values ||
            []
          ).find(
            (v) =>
              String(
                v.energy_type_id
              ) ===
              String(
                typeId
              )
          );

        return (
          sum +
          (match
            ? Number(
                match.value ||
                  0
              )
            : 0)
        );
      },
      0
    );
  }

  function grandTotal() {
    return records.reduce(
      (
        sum,
        r
      ) => {
        const sub =
          (
            r.energy_values ||
            []
          ).reduce(
            (
              s,
              v
            ) =>
              s +
              Number(
                v.value ||
                  0
              ),
            0
          );

        return (
          sum + sub
        );
      },
      0
    );
  }

  /*
   * เพิ่มช่วงเวลา
   */
  function addSelection(
    month,
    year
  ) {
    setSelected(
      (prev) => {
        const list =
          prev[
            periodType
          ];

        const exists =
          periodType ===
          'monthly'
            ? list.some(
                (p) =>
                  p.month ===
                    month &&
                  p.year ===
                    year
              )
            : list.some(
                (p) =>
                  p.year ===
                  year
              );

        if (
          exists
        ) {
          return prev;
        }

        const newItem =
          periodType ===
          'monthly'
            ? {
                month,
                year,
              }
            : {
                year,
              };

        return {
          ...prev,
          [periodType]: [
            ...list,
            newItem,
          ],
        };
      }
    );
  }

  /*
   * ลบช่วงเวลา
   */
  function removeSelection(
    idx
  ) {
    setSelected(
      (prev) => ({
        ...prev,
        [periodType]:
          prev[
            periodType
          ].filter(
            (_, i) =>
              i !== idx
          ),
      })
    );
  }

  const chartData =
    buildChartData();

  const breakdownTotal =
    breakdown.reduce(
      (sum, b) =>
        sum + b.value,
      0
    );

  return (
    <div
      style={{
        padding:
          '32px',
      }}
    >
      {/* HEADER */}

      <div
        style={{
          display:
            'flex',
          justifyContent:
            'space-between',
          alignItems:
            'center',
          marginBottom:
            '24px',
        }}
      >
        <div>
          <h1
            style={{
              fontSize:
                '28px',
              fontWeight:
                700,
              margin: 0,
            }}
          >
            ⚡ Factory Energy
            Management
          </h1>

          <p
            style={{
              color:
                '#64748b',
              marginTop:
                '4px',
            }}
          >
            ภาพรวมการใช้พลังงานของโรงงาน
          </p>
        </div>
      </div>

      {/* เลือกโหมด */}

      <div
        style={{
          display:
            'flex',
          gap:
            '8px',
          marginBottom:
            '16px',
        }}
      >
        {[
          'monthly',
          'yearly',
        ].map(
          (mode) => (
            <button
              key={
                mode
              }
              onClick={() =>
                setPeriodType(
                  mode
                )
              }
              style={{
                padding:
                  '8px 16px',
                borderRadius:
                  '6px',
                border:
                  '1px solid #e2e8f0',
                background:
                  periodType ===
                  mode
                    ? '#1e293b'
                    : 'white',
                color:
                  periodType ===
                  mode
                    ? 'white'
                    : '#1e293b',
                cursor:
                  'pointer',
                fontWeight:
                  500,
              }}
            >
              {mode ===
              'monthly'
                ? 'รายเดือน'
                : 'รายปี'}
            </button>
          )
        )}
      </div>

      {/* เลือกเดือน/ปี */}

      <div
        style={{
          background:
            'white',
          border:
            '1px solid #e2e8f0',
          borderRadius:
            '12px',
          padding:
            '16px',
          marginBottom:
            '20px',
        }}
      >
        <div
          style={{
            display:
              'flex',
            gap:
              '12px',
            alignItems:
              'flex-end',
            flexWrap:
              'wrap',
          }}
        >
          {periodType ===
            'monthly' && (
            <div>
              <label
                style={{
                  display:
                    'block',
                  fontSize:
                    '13px',
                  marginBottom:
                    '4px',
                }}
              >
                เดือน
              </label>

              <select
                value={
                  pickMonth
                }
                onChange={(
                  e
                ) => {
                  const month =
                    Number(
                      e.target
                        .value
                    );

                  setPickMonth(
                    month
                  );

                  addSelection(
                    month,
                    pickYear
                  );
                }}
                style={{
                  padding:
                    '8px',
                  borderRadius:
                    '6px',
                  border:
                    '1px solid #cbd5e1',
                }}
              >
                {MONTH_NAMES.map(
                  (
                    name,
                    i
                  ) => (
                    <option
                      key={
                        i
                      }
                      value={
                        i + 1
                      }
                    >
                      {name}
                    </option>
                  )
                )}
              </select>
            </div>
          )}

          <div>
            <label
              style={{
                display:
                  'block',
                fontSize:
                  '13px',
                marginBottom:
                  '4px',
              }}
            >
              ปี
            </label>

            <select
              value={
                pickYear
              }
              onChange={(
                e
              ) => {
                const year =
                  Number(
                    e.target
                      .value
                  );

                setPickYear(
                  year
                );

                addSelection(
                  pickMonth,
                  year
                );
              }}
              style={{
                padding:
                  '8px',
                borderRadius:
                  '6px',
                border:
                  '1px solid #cbd5e1',
              }}
            >
              {YEAR_OPTIONS.map(
                (y) => (
                  <option
                    key={
                      y
                    }
                    value={
                      y
                    }
                  >
                    {y}
                  </option>
                )
              )}
            </select>
          </div>
        </div>

        {/* รายการที่เลือก */}

        <div
          style={{
            display:
              'flex',
            gap:
              '8px',
            flexWrap:
              'wrap',
            marginTop:
              '14px',
          }}
        >
          {currentSelection.length ===
          0 ? (
            <span
              style={{
                color:
                  '#94a3b8',
                fontSize:
                  '13px',
              }}
            >
              ยังไม่ได้เลือกช่วงเวลา
            </span>
          ) : (
            currentSelection.map(
              (
                p,
                i
              ) => (
                <span
                  key={
                    i
                  }
                  style={{
                    display:
                      'inline-flex',
                    alignItems:
                      'center',
                    gap:
                      '6px',
                    background:
                      '#eff6ff',
                    color:
                      '#1e40af',
                    borderRadius:
                      '999px',
                    padding:
                      '4px 6px 4px 12px',
                    fontSize:
                      '13px',
                  }}
                >
                  {periodType ===
                  'monthly'
                    ? periodToLabel(
                        'monthly',
                        p.month,
                        p.year
                      )
                    : periodToLabel(
                        'yearly',
                        null,
                        p.year
                      )}

                  <button
                    onClick={() =>
                      removeSelection(
                        i
                      )
                    }
                    style={{
                      border:
                        'none',
                      background:
                        'none',
                      color:
                        '#1e40af',
                      cursor:
                        'pointer',
                      fontWeight:
                        700,
                    }}
                  >
                    ×
                  </button>
                </span>
              )
            )
          )}
        </div>
      </div>

      {loading ? (
        <p>
          กำลังโหลดข้อมูล...
        </p>
      ) : (
        <>
          {/* KPI */}

          <div
            style={{
              display:
                'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(200px, 1fr))',
              gap:
                '16px',
              marginBottom:
                '28px',
            }}
          >
            <div
              style={{
                background:
                  'white',
                border:
                  '1px solid #e2e8f0',
                borderRadius:
                  '12px',
                padding:
                  '20px',
              }}
            >
              <div
                style={{
                  color:
                    '#64748b',
                  fontSize:
                    '13px',
                }}
              >
                พลังงานรวมทุกประเภท
              </div>

              <div
                style={{
                  fontSize:
                    '26px',
                  fontWeight:
                    700,
                  marginTop:
                    '4px',
                }}
              >
                {grandTotal().toLocaleString(
                  undefined,
                  {
                    maximumFractionDigits:
                      2,
                  }
                )}
              </div>
            </div>

            {energyTypes.map(
              (
                t,
                i
              ) => (
                <div
                  key={
                    t.id
                  }
                  style={{
                    background:
                      'white',
                    border:
                      '1px solid #e2e8f0',
                    borderLeft:
                      `4px solid ${
                        PALETTE[
                          i %
                            PALETTE.length
                        ]
                      }`,
                    borderRadius:
                      '12px',
                    padding:
                      '20px',
                  }}
                >
                  <div
                    style={{
                      color:
                        '#64748b',
                      fontSize:
                        '13px',
                    }}
                  >
                    {
                      t.energy_name
                    }{' '}
                    (
                    {
                      t.unit
                    }
                    )
                  </div>

                  <div
                    style={{
                      fontSize:
                        '22px',
                      fontWeight:
                        700,
                      marginTop:
                        '4px',
                    }}
                  >
                    {totalForType(
                      t.id
                    ).toLocaleString(
                      undefined,
                      {
                        maximumFractionDigits:
                          2,
                      }
                    )}
                  </div>
                </div>
              )
            )}
          </div>

          {/* กราฟ */}

          <div
            style={{
              marginBottom:
                '20px',
            }}
          >
            <h3
              style={{
                marginTop:
                  0,
                marginBottom:
                  '12px',
              }}
            >
              การใช้พลังงานแยกตามประเภท ตามช่วงเวลาที่เลือก
            </h3>

            {records.length ===
            0 ? (
              <div
                style={{
                  background:
                    'white',
                  border:
                    '1px solid #e2e8f0',
                  borderRadius:
                    '12px',
                  padding:
                    '20px',
                }}
              >
                <p
                  style={{
                    color:
                      '#94a3b8',
                  }}
                >
                  ไม่มีข้อมูลตรงกับช่วงเวลาที่เลือก
                </p>
              </div>
            ) : (
              <div
                style={{
                  display:
                    'grid',
                  gridTemplateColumns:
                    'repeat(auto-fit, minmax(360px, 1fr))',
                  gap:
                    '16px',
                }}
              >
                {energyTypes.map(
                  (
                    t,
                    i
                  ) => {
                    const series =
                      typeSeries(
                        t
                      );

                    return (
                      <div
                        key={
                          t.id
                        }
                        onClick={() =>
                          setExpandedTypeId(
                            t.id
                          )
                        }
                        style={{
                          background:
                            'white',
                          border:
                            '1px solid #e2e8f0',
                          borderRadius:
                            '12px',
                          padding:
                            '16px',
                          cursor:
                            'pointer',
                        }}
                      >
                        <div
                          style={{
                            display:
                              'flex',
                            justifyContent:
                              'space-between',
                            alignItems:
                              'center',
                            marginBottom:
                              '8px',
                          }}
                        >
                          <h4
                            style={{
                              margin:
                                0,
                              fontSize:
                                '15px',
                            }}
                          >
                            {
                              t.energy_name
                            }{' '}
                            (
                            {
                              t.unit
                            }
                            )
                          </h4>

                          <button
                            onClick={(
                              e
                            ) => {
                              e.stopPropagation();

                              setExpandedTypeId(
                                t.id
                              );
                            }}
                            style={{
                              border:
                                '1px solid #cbd5e1',
                              background:
                                'white',
                              borderRadius:
                                '6px',
                              padding:
                                '4px 10px',
                              fontSize:
                                '12px',
                              cursor:
                                'pointer',
                            }}
                          >
                            ⤢ ขยาย
                          </button>
                        </div>

                        <ResponsiveContainer
                          width="100%"
                          height={
                            280
                          }
                        >
                          <BarChart
                            data={
                              series
                            }
                            margin={{
                              top: 35,
                              right: 10,
                              left: 0,
                              bottom: 15,
                            }}
                            barCategoryGap="20%"
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                            />

                            <XAxis
                              dataKey="key"
                              interval={
                                0
                              }
                              angle={
                                periodType ===
                                'monthly'
                                  ? 0
                                  : -25
                              }
                              textAnchor={
                                periodType ===
                                'monthly'
                                  ? 'middle'
                                  : 'end'
                              }
                              height={
                                periodType ===
                                'monthly'
                                  ? 35
                                  : 55
                              }
                              tick={{
                                fontSize:
                                  10,
                              }}
                            />

                            <YAxis
                              tick={{
                                fontSize:
                                  11,
                              }}
                            />

                            <Tooltip
                              formatter={(
                                value,
                                name
                              ) => [
                                Number(
                                  value ||
                                    0
                                ).toLocaleString(),
                                name,
                              ]}
                            />

                            {periodType ===
                            'monthly' ? (
                              <>
                                <Legend />

                                {chartYears().map(
                                  (
                                    year,
                                    yearIndex
                                  ) => {
                                    const dataKey =
                                      `year_${year}`;

                                    const comparisonSeries =
                                      yearSeries(
                                        series,
                                        year
                                      );

                                    return (
                                      <Bar
                                        key={
                                          year
                                        }
                                        dataKey={
                                          dataKey
                                        }
                                        name={`ปี ${year}`}
                                        fill={
                                          PALETTE[
                                            yearIndex %
                                              PALETTE.length
                                          ]
                                        }
                                        radius={[
                                          4,
                                          4,
                                          0,
                                          0,
                                        ]}
                                      >
                                        <LabelList
                                          content={(
                                            props
                                          ) => (
                                            <ChangeBarLabel
                                              {...props}
                                              series={
                                                comparisonSeries
                                              }
                                            />
                                          )}
                                        />
                                      </Bar>
                                    );
                                  }
                                )}
                              </>
                            ) : (
                              <Bar
                                dataKey="value"
                                name="การใช้พลังงาน"
                                fill={
                                  PALETTE[
                                    i %
                                      PALETTE.length
                                  ]
                                }
                                radius={[
                                  4,
                                  4,
                                  0,
                                  0,
                                ]}
                              >
                                <LabelList
                                  content={(
                                    props
                                  ) => (
                                    <ChangeBarLabel
                                      {...props}
                                      series={
                                        series
                                      }
                                    />
                                  )}
                                />
                              </Bar>
                            )}
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    );
                  }
                )}
              </div>
            )}

            <p
              style={{
                color:
                  '#94a3b8',
                fontSize:
                  '12px',
                marginTop:
                  '8px',
              }}
            >
              ▲/▼ คือเปอร์เซ็นต์การเปลี่ยนแปลงของข้อมูล
            </p>
          </div>

          {/* PIE CHART */}

          <div
            style={{
              background:
                'white',
              border:
                '1px solid #e2e8f0',
              borderRadius:
                '12px',
              padding:
                '20px',
              marginBottom:
                '20px',
            }}
          >
            <h3
              style={{
                marginTop:
                  0,
              }}
            >
              สัดส่วนการใช้ไฟฟ้าตามระบบ
            </h3>

            {breakdownTotal ===
            0 ? (
              <p
                style={{
                  color:
                    '#94a3b8',
                }}
              >
                ไม่มีข้อมูลสัดส่วนไฟฟ้าตรงกับช่วงเวลาที่เลือก
              </p>
            ) : (
              <ResponsiveContainer
                width="100%"
                height={
                  320
                }
              >
                <PieChart>
                  <Pie
                    data={
                      breakdown
                    }
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={
                      110
                    }
                    label={({
                      name,
                      value,
                      percent,
                    }) =>
                      `${name}: ${(
                        percent *
                        100
                      ).toFixed(
                        1
                      )}% (${value.toLocaleString()} kWh)`
                    }
                  >
                    {breakdown.map(
                      (b) => (
                        <Cell
                          key={
                            b.key
                          }
                          fill={
                            b.color
                          }
                        />
                      )
                    )}
                  </Pie>

                  <Tooltip
                    formatter={(
                      value
                    ) =>
                      `${Number(
                        value
                      ).toLocaleString()} kWh`
                    }
                  />

                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </>
      )}

      {/* MODAL */}

      {expandedTypeId &&
        (() => {
          const t =
            energyTypes.find(
              (et) =>
                String(et.id) ===
                String(
                  expandedTypeId
                )
            );

          if (!t) {
            return null;
          }

          const series =
            typeSeries(t);

          const idx =
            energyTypes.findIndex(
              (et) =>
                String(et.id) ===
                String(
                  expandedTypeId
                )
            );

          return (
            <div
              onClick={() =>
                setExpandedTypeId(
                  null
                )
              }
              style={{
                position:
                  'fixed',
                inset: 0,
                background:
                  'rgba(15, 23, 42, 0.55)',
                display:
                  'flex',
                alignItems:
                  'center',
                justifyContent:
                  'center',
                padding:
                  '24px',
                zIndex:
                  1000,
              }}
            >
              <div
                onClick={(e) =>
                  e.stopPropagation()
                }
                style={{
                  background:
                    'white',
                  borderRadius:
                    '16px',
                  padding:
                    '24px',
                  width:
                    '100%',
                  maxWidth:
                    '900px',
                  maxHeight:
                    '90vh',
                  overflow:
                    'auto',
                }}
              >
                <div
                  style={{
                    display:
                      'flex',
                    justifyContent:
                      'space-between',
                    alignItems:
                      'center',
                    marginBottom:
                      '16px',
                  }}
                >
                  <h3
                    style={{
                      margin:
                        0,
                    }}
                  >
                    {
                      t.energy_name
                    }{' '}
                    (
                    {
                      t.unit
                    }
                    )
                  </h3>

                  <button
                    onClick={() =>
                      setExpandedTypeId(
                        null
                      )
                    }
                    style={{
                      border:
                        'none',
                      background:
                        '#f1f5f9',
                      borderRadius:
                        '8px',
                      width:
                        '32px',
                      height:
                        '32px',
                      fontSize:
                        '16px',
                      cursor:
                        'pointer',
                    }}
                  >
                    ×
                  </button>
                </div>

                {series.length ===
                0 ? (
                  <p
                    style={{
                      color:
                        '#94a3b8',
                    }}
                  >
                    ไม่มีข้อมูลตรงกับช่วงเวลาที่เลือก
                  </p>
                ) : (
                  <>
                    <ResponsiveContainer
                      width="100%"
                      height={
                        460
                      }
                    >
                      <BarChart
                        data={
                          series
                        }
                        margin={{
                          top: 40,
                          right: 20,
                          left: 0,
                          bottom: 15,
                        }}
                        barCategoryGap="18%"
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                        />

                        <XAxis
                          dataKey="key"
                          interval={
                            0
                          }
                          angle={
                            periodType ===
                            'monthly'
                              ? 0
                              : -25
                          }
                          textAnchor={
                            periodType ===
                            'monthly'
                              ? 'middle'
                              : 'end'
                          }
                          height={
                            periodType ===
                            'monthly'
                              ? 35
                              : 65
                          }
                          tick={{
                            fontSize:
                              12,
                          }}
                        />

                        <YAxis
                          tick={{
                            fontSize:
                              13,
                          }}
                        />

                        <Tooltip
                          formatter={(
                            value,
                            name
                          ) => [
                            Number(
                              value ||
                                0
                            ).toLocaleString(),
                            name,
                          ]}
                        />

                        {periodType ===
                        'monthly' ? (
                          <>
                            <Legend />

                            {chartYears().map(
                              (
                                year,
                                yearIndex
                              ) => {
                                const dataKey =
                                  `year_${year}`;

                                const comparisonSeries =
                                  yearSeries(
                                    series,
                                    year
                                  );

                                return (
                                  <Bar
                                    key={
                                      year
                                    }
                                    dataKey={
                                      dataKey
                                    }
                                    name={`ปี ${year}`}
                                    fill={
                                      PALETTE[
                                        yearIndex %
                                          PALETTE.length
                                      ]
                                    }
                                    radius={[
                                      6,
                                      6,
                                      0,
                                      0,
                                    ]}
                                  >
                                    <LabelList
                                      content={(
                                        props
                                      ) => (
                                        <ChangeBarLabel
                                          {...props}
                                          series={
                                            comparisonSeries
                                          }
                                        />
                                      )}
                                    />
                                  </Bar>
                                );
                              }
                            )}
                          </>
                        ) : (
                          <Bar
                            dataKey="value"
                            name="การใช้พลังงาน"
                            fill={
                              PALETTE[
                                idx %
                                  PALETTE.length
                              ]
                            }
                            radius={[
                              6,
                              6,
                              0,
                              0,
                            ]}
                          >
                            <LabelList
                              content={(
                                props
                              ) => (
                                <ChangeBarLabel
                                  {...props}
                                  series={
                                    series
                                  }
                                />
                              )}
                            />
                          </Bar>
                        )}
                      </BarChart>
                    </ResponsiveContainer>
                  </>
                )}
              </div>
            </div>
          );
        })()}
    </div>
  );
}
