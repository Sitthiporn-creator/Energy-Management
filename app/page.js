"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Home() {
  const [energyTypes, setEnergyTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadData() {
      const { data, error } = await supabase
        .from("energy_types")
        .select("*")
        .order("id");

      if (error) {
        setError(error.message);
      } else {
        setEnergyTypes(data || []);
      }

      setLoading(false);
    }

    loadData();
  }, []);

  return (
    <main style={{ padding: 40, fontFamily: "sans-serif" }}>
      <h1>⚡ Factory Energy Management</h1>

      {loading && <p>กำลังโหลดข้อมูลจาก Supabase...</p>}

      {error && (
        <p style={{ color: "red" }}>
          เชื่อมต่อ Supabase ไม่สำเร็จ: {error}
        </p>
      )}

      {!loading && !error && (
        <>
          <p>เชื่อมต่อ Supabase สำเร็จ! พบประเภทพลังงาน {energyTypes.length} รายการ:</p>
          <ul>
            {energyTypes.map((item) => (
              <li key={item.id}>
                {item.energy_name} ({item.unit})
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
