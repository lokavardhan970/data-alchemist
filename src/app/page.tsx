"use client";

import { useState } from "react";
import { read, utils } from "xlsx";
import Papa from "papaparse";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import "@mui/x-data-grid/themeAugmentation";
import "./globals.css"; // ✅ Make sure this path is correct

interface ValidationError {
  rowIndex: number;
  column: string;
  message: string;
}

export default function Home() {
  const [clients, setClients] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [selectedFileType, setSelectedFileType] = useState<string>("");
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedFileType) return;

    setUploadedFileName(`${selectedFileType}.csv`);
    setClients([]);
    setWorkers([]);
    setTasks([]);
    setValidationErrors([]);

    const reader = new FileReader();

    if (file.name.endsWith(".csv")) {
      reader.onload = (event) => {
        const csvText = event.target?.result;
        if (typeof csvText === "string") {
          const parsed = Papa.parse(csvText, {
            header: true,
            skipEmptyLines: false,
          });
          const cleaned = parsed.data.map((row, idx) => ({ ...row, id: idx }));
          assignData(cleaned);
          runValidation(cleaned);
        }
      };
      reader.readAsText(file);
    } else if (file.name.endsWith(".xlsx")) {
      reader.onload = (event) => {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = utils.sheet_to_json(sheet, { header: 1 });
        const headers = jsonData[0] as string[];
        const rows = jsonData.slice(1).map((row: any[], idx) => {
          const rowData: any = { id: idx };
          headers.forEach((h, i) => (rowData[h] = row[i]));
          return rowData;
        });
        assignData(rows);
        runValidation(rows);
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const assignData = (data: any[]) => {
    if (selectedFileType === "clients") setClients(data);
    if (selectedFileType === "workers") setWorkers(data);
    if (selectedFileType === "tasks") setTasks(data);
  };

  const runValidation = (data: any[]) => {
    const errors: ValidationError[] = [];
    const seenIds = new Set();

    const workerSkills = workers.flatMap((w) =>
      String(w.Skills || "")
        .toLowerCase()
        .split(/[, ]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    );

    data.forEach((row, idx) => {
      for (const [key, value] of Object.entries(row)) {
        if (key !== "id" && (value === undefined || value === null || value === "")) {
          errors.push({ rowIndex: idx, column: key, message: "Missing value" });
        }

        if (key.toLowerCase().includes("id") && seenIds.has(value)) {
          errors.push({ rowIndex: idx, column: key, message: "Duplicate ID" });
        } else if (key.toLowerCase().includes("id")) {
          seenIds.add(value);
        }

        if (key === "PriorityLevel") {
          const val = parseInt(value as string);
          if (isNaN(val) || val < 1 || val > 5) {
            errors.push({ rowIndex: idx, column: key, message: "PriorityLevel must be between 1 and 5." });
          }
        }

        if (key === "RequiredSkills") {
          const requiredSkills = String(value || "")
            .toLowerCase()
            .split(/[, ]+/)
            .map((s) => s.trim())
            .filter(Boolean);
          requiredSkills.forEach((skill) => {
            if (!workerSkills.includes(skill)) {
              errors.push({ rowIndex: idx, column: key, message: `No worker found with required skill: ${skill}` });
            }
          });
        }
      }
    });

    setValidationErrors(errors);
  };

  const getCurrentData = () => {
    let data =
      selectedFileType === "clients"
        ? clients
        : selectedFileType === "workers"
        ? workers
        : tasks;

    if (searchQuery.trim() === "") return data;

    const match = searchQuery.match(/^([\w\s]+?)\s*(=|!=|>|<|>=|<=|includes)\s*(.+)$/i);
    if (!match) {
      const lower = searchQuery.toLowerCase();
      return data.filter((row) =>
        Object.values(row).some((val) => String(val).toLowerCase().includes(lower))
      );
    }

    const [, field, operator, value] = match;
    return data.filter((row) => {
      const actual = row[field.trim()];
      if (actual === undefined) return false;

      const actualStr = String(actual).toLowerCase();
      const val = value.trim().toLowerCase();

      switch (operator) {
        case "=":
          return actualStr === val;
        case "!=":
          return actualStr !== val;
        case ">":
          return parseFloat(actualStr) > parseFloat(val);
        case "<":
          return parseFloat(actualStr) < parseFloat(val);
        case ">=":
          return parseFloat(actualStr) >= parseFloat(val);
        case "<=":
          return parseFloat(actualStr) <= parseFloat(val);
        case "includes":
          return actualStr.includes(val);
        default:
          return false;
      }
    });
  };

  const getColumns = (): GridColDef[] => {
    const sample = getCurrentData()[0];
    if (!sample) return [];

    return Object.keys(sample).map((field) => ({
      field,
      headerName: field,
      flex: 1,
      minWidth: 150,
      editable: true,
      cellClassName: (params) => {
        const error = validationErrors.find(
          (e) => e.rowIndex === params.row.id && e.column === field
        );
        return error ? "error-cell" : "";
      },
    }));
  };

  const processRowUpdate = (newRow: any) => {
    const updatedData = [...getCurrentData()];
    const idx = updatedData.findIndex((r) => r.id === newRow.id);
    updatedData[idx] = newRow;
    assignData(updatedData);
    runValidation(updatedData);
    return newRow;
  };

  return (
 <div className="min-h-screen bg-gray-50">
  {/* Navbar */}
  <nav className="bg-blue-700 text-white py-6 shadow-md">
    <h1 className="text-center text-4xl font-bold">🧪 Data Alchemist</h1>
  </nav>

  {/* Controls */}
  <div className="flex flex-col items-center px-6 py-10 space-y-6">
    {/* Controls row */}
    <div className="flex flex-wrap justify-center items-center gap-8">
      {/* Dropdown */}
      <select
        value={selectedFileType}
        onChange={(e) => setSelectedFileType(e.target.value)}
        className="border px-6 py-4 rounded text-lg w-72 shadow-lg"
      >
        <option value="">Select File Type</option>
        <option value="clients">Clients</option>
        <option value="workers">Workers</option>
        <option value="tasks">Tasks</option>
      </select>

      {/* File Upload */}
      <label className="bg-blue-600 text-white px-20 py-20 rounded-lg cursor-pointer hover:bg-blue-700 text-lg shadow-lg">
        📁 Choose File
        <input
          type="file"
          accept=".csv,.xlsx"
          onChange={handleFileUpload}
          className="hidden"
        />
      </label>

      {/* Export Button */}
      {uploadedFileName && (
        <button
          className="bg-green-600 text-white px-6 py-4 rounded-lg hover:bg-green-700 text-lg shadow-lg"
          onClick={() => {
            const data = getCurrentData();
            if (data.length === 0) return;

            const csv = Papa.unparse(data);
            const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", `${selectedFileType}_validated.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }}
        >
          ⬇️ Export CSV
        </button>
      )}
    </div>

    {/* Filter bar */}
    <input
  type="text"
  placeholder="🔍 Filter (e.g. 'PriorityLevel > 3')"
  className="border rounded text-xl w-full max-w-4xl <h-50></h-50> leading-tight px-50 shadow-md"
  value={searchQuery}
  onChange={(e) => setSearchQuery(e.target.value)}
/>

  </div>

  {/* Data Table */}
  <div className="px-8 pb-8">
    <div style={{ width: "100%", height: 600 }}>
      <DataGrid
        rows={getCurrentData()}
        columns={getColumns()}
        processRowUpdate={processRowUpdate}
        disableRowSelectionOnClick
        getRowId={(row) => row.id}
        experimentalFeatures={{ newEditingApi: true }}
      />
    </div>

    {/* Validation Summary */}
    {validationErrors.length > 0 && (
      <div className="mt-6 p-4 border border-red-300 rounded bg-red-50 text-red-800 max-h-64 overflow-y-auto">
        <h2 className="font-semibold mb-2">
          ⚠️ Validation Summary: {validationErrors.length} issue(s) found
        </h2>
        <ul className="text-sm list-disc pl-5 space-y-1 max-h-48 overflow-y-scroll">
          {validationErrors.map((err, idx) => (
            <li key={idx}>
              Row {err.rowIndex + 1}, Column <strong>{err.column}</strong>: {err.message}
            </li>
          ))}
        </ul>
      </div>
    )}
  </div>
</div>
);
}
