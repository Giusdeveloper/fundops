import React from "react";
import { LineChart as LucideLineChart } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import './MainChart.css';

const data = [
  { name: 'Gen', valore: 400 },
  { name: 'Feb', valore: 700 },
  { name: 'Mar', valore: 600 },
  { name: 'Apr', valore: 900 },
  { name: 'Mag', valore: 1200 },
  { name: 'Giu', valore: 1100 },
  { name: 'Lug', valore: 1500 },
  { name: 'Ago', valore: 1300 },
];

const MainChart = () => {
  return (
    <div className="main-chart-container">
      <h2 className="main-chart-title">
        <LucideLineChart size={22} className="main-chart-icon" />
        Andamento Fondi Raccolti
      </h2>
      <div className="main-chart-responsive">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorValore" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="name" stroke="#a1a1aa" />
            <YAxis stroke="#a1a1aa" />
            <Tooltip contentStyle={{ background: '#23272f', border: 'none', color: '#f3f4f6' }} />
            <Legend iconType="circle" wrapperStyle={{ color: '#f3f4f6' }} />
            <Area type="monotone" dataKey="valore" stroke="#3b82f6" fillOpacity={1} fill="url(#colorValore)" name="Fondi Raccolti" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default MainChart; 