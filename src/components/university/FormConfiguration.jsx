import { useEffect, useMemo, useState } from "react";
import { GripVertical, Plus, Save, Trash2, X } from "lucide-react";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import {
  clearUniversityFormSetupMessages,
  fetchUniversityFormSetup,
  saveUniversityFormSetup,
} from "../../store/slices/universityFormSetupSlice";

function FormConfiguration() {
  const dispatch = useAppDispatch();
  const {
    fields: storedFields,
    programs: storedPrograms,
    applicationFee: storedApplicationFee,
    loading: isLoading,
    saving: isSaving,
    error: loadError,
    saveError,
    saveSuccessMessage,
  } = useAppSelector((state) => state.universityFormSetup);

  const [fields, setFields] = useState([]);
  const [showAddField, setShowAddField] = useState(false);

  const [programs, setPrograms] = useState([]);
  const [applicationFee, setApplicationFee] = useState("0");
  const [showAddProgram, setShowAddProgram] = useState(false);
  const [editingProgram, setEditingProgram] = useState(null);
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    dispatch(fetchUniversityFormSetup());
  }, [dispatch]);

  useEffect(() => {
    setFields(Array.isArray(storedFields) ? storedFields : []);
  }, [storedFields]);

  useEffect(() => {
    setPrograms(Array.isArray(storedPrograms) ? storedPrograms : []);
  }, [storedPrograms]);

  useEffect(() => {
    setApplicationFee(String(storedApplicationFee ?? "0"));
  }, [storedApplicationFee]);

  const resetMessages = () => {
    setLocalError("");
    dispatch(clearUniversityFormSetupMessages());
  };

  const stats = useMemo(
    () => ({
      totalFields: fields.length,
      requiredFields: fields.filter((field) => field.required).length,
      totalPrograms: programs.length,
      applicationFee: Number(applicationFee || 0),
    }),
    [fields, programs, applicationFee],
  );

  const handleAddField = (field) => {
    resetMessages();
    setFields((previous) => [...previous, { ...field, id: `${Date.now()}` }]);
    setShowAddField(false);
  };

  const handleDeleteField = (id) => {
    resetMessages();
    setFields((previous) => previous.filter((field) => field.id !== id));
  };

  const handleToggleRequired = (id) => {
    resetMessages();
    setFields((previous) =>
      previous.map((field) =>
        field.id === id ? { ...field, required: !field.required } : field,
      ),
    );
  };

  const handleAddProgram = (program) => {
    resetMessages();
    setPrograms((previous) => [...previous, { ...program, id: `${Date.now()}` }]);
    setShowAddProgram(false);
  };

  const handleEditProgram = (program) => {
    resetMessages();
    setPrograms((previous) => previous.map((item) => (item.id === program.id ? program : item)));
    setEditingProgram(null);
  };

  const handleDeleteProgram = (id) => {
    resetMessages();
    setPrograms((previous) => previous.filter((program) => program.id !== id));
  };

  const handleSave = async () => {
    resetMessages();
    try {
      await dispatch(
        saveUniversityFormSetup({
          fields,
          programs,
          applicationFee,
        }),
      ).unwrap();
    } catch (saveError) {
      setLocalError(saveError || "Unable to save configuration.");
    }
  };

  const error = localError || saveError || loadError;
  const statusMessage = saveSuccessMessage;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-slate-900 mb-2">Form Configuration</h1>
          <p className="text-slate-600">
            Manage application form fields and programs. Student recommendation programs come from this page.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={isLoading || isSaving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-70"
        >
          <Save className="w-4 h-4" />
          {isSaving ? "Saving..." : "Save Configuration"}
        </button>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <StatCard label="Form Fields" value={stats.totalFields} />
        <StatCard label="Required Fields" value={stats.requiredFields} />
        <StatCard label="Programs" value={stats.totalPrograms} subLabel={`Fee PKR ${stats.applicationFee.toLocaleString()}`} />
        <StatCard label="Template Mode" value="Generated" subLabel="UAAMS creates the template automatically" />
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {statusMessage ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {statusMessage}
        </p>
      ) : null}

      {isLoading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Loading form configuration...
        </div>
      ) : null}

      {!isLoading ? (
        <>
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h3 className="text-slate-900 mb-4">Application Form Fields</h3>
            <div className="space-y-3">
              {fields.map((field, index) => (
                <FormFieldItem
                  key={field.id}
                  field={field}
                  index={index}
                  onDelete={handleDeleteField}
                  onToggleRequired={handleToggleRequired}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowAddField(true)}
              className="mt-4 flex items-center gap-2 px-4 py-2 border-2 border-dashed border-slate-300 text-slate-600 rounded-lg hover:border-blue-400 hover:text-blue-600 transition-colors w-full justify-center"
            >
              <Plus className="w-5 h-5" />
              Add Custom Field
            </button>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h3 className="text-slate-900 mb-4">Available Programs</h3>
            <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <label className="mb-2 block text-sm text-slate-700">Application Fee (PKR)</label>
              <input
                type="number"
                min="0"
                value={applicationFee}
                onChange={(event) => {
                  resetMessages();
                  setApplicationFee(event.target.value);
                }}
                placeholder="e.g., 2500"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-slate-500">
                This fee is shown on student recommendations and payment page.
              </p>
            </div>
            <div className="space-y-3">
              {programs.map((program) => (
                <ProgramItem
                  key={program.id}
                  program={program}
                  onEdit={setEditingProgram}
                  onDelete={handleDeleteProgram}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowAddProgram(true)}
              className="mt-4 flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Program
            </button>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            Student preview and PDF download use an automatically generated UAAMS application
            template. Only form fields, programs, and fee are configurable here.
          </div>
        </>
      ) : null}

      {showAddField ? <AddFieldModal onAdd={handleAddField} onClose={() => setShowAddField(false)} /> : null}

      {showAddProgram ? (
        <ProgramModal onSave={handleAddProgram} onClose={() => setShowAddProgram(false)} />
      ) : null}

      {editingProgram ? (
        <ProgramModal
          program={editingProgram}
          onSave={handleEditProgram}
          onClose={() => setEditingProgram(null)}
        />
      ) : null}
    </div>
  );
}

function StatCard({ label, value, subLabel = "" }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-sm text-slate-600">{label}</div>
      <div className="text-2xl text-slate-900">{value}</div>
      {subLabel ? <div className="mt-1 text-xs text-slate-500">{subLabel}</div> : null}
    </div>
  );
}

function FormFieldItem({ field, index, onDelete, onToggleRequired }) {
  return (
    <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
      <GripVertical className="w-5 h-5 text-slate-400 cursor-move" />
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-slate-900">{index + 1}. {field.label}</span>
          {field.required ? (
            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded">Required</span>
          ) : null}
        </div>
        <div className="text-slate-600 text-sm">Type: {field.type}</div>
      </div>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            checked={field.required}
            onChange={() => onToggleRequired(field.id)}
            className="rounded border-slate-300"
          />
          Required
        </label>
        <button
          type="button"
          onClick={() => onDelete(field.id)}
          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function ProgramItem({ program, onEdit, onDelete }) {
  return (
    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
      <div>
        <div className="text-slate-900 mb-1">{program.name}</div>
        <div className="text-slate-600 text-sm">
          {program.seats} seats | {program.feeRange || "Fee range not set"} | Min Aggregate: {program.requiredAggregate}%
        </div>
        <div className="text-slate-500 text-xs">
          Deadline: {program.deadlineDate || "Not announced"}
        </div>
        <div className="mt-1 text-xs">
          <span
            className={`rounded-full px-2 py-1 ${
              program.isAdmissionOpen
                ? "bg-emerald-100 text-emerald-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {program.isAdmissionOpen ? "Admission Open" : "Admission Closed"}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onEdit(program)}
          className="px-3 py-1 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-sm"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => onDelete(program.id)}
          className="px-3 py-1 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm"
        >
          Remove
        </button>
      </div>
    </div>
  );
}

function AddFieldModal({ onAdd, onClose }) {
  const [newField, setNewField] = useState({
    id: "",
    label: "",
    type: "text",
    required: false,
    placeholder: "",
  });

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!newField.label.trim()) return;
    onAdd({
      ...newField,
      options: [],
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <h2 className="text-slate-900 mb-4">Add Custom Field</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-slate-700 mb-2 text-sm">Field Label</label>
            <input
              type="text"
              value={newField.label}
              onChange={(event) => setNewField({ ...newField, label: event.target.value })}
              placeholder="e.g., Guardian Phone Number"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-slate-700 mb-2 text-sm">Field Type</label>
            <select
              value={newField.type}
              onChange={(event) => setNewField({ ...newField, type: event.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="text">Text</option>
              <option value="email">Email</option>
              <option value="number">Number</option>
              <option value="tel">Phone</option>
              <option value="textarea">Paragraph</option>
              <option value="date">Date</option>
              <option value="file">File Upload</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-700 mb-2 text-sm">Placeholder (optional)</label>
            <input
              type="text"
              value={newField.placeholder}
              onChange={(event) => setNewField({ ...newField, placeholder: event.target.value })}
              placeholder="Optional hint for students"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={newField.required}
              onChange={(event) => setNewField({ ...newField, required: event.target.checked })}
              className="rounded border-slate-300"
            />
            Required Field
          </label>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Add Field
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ProgramModal({ program, onSave, onClose }) {
  const [formData, setFormData] = useState(() => {
    const initialProgram = program || {};
    return {
      id: "",
      name: "",
      seats: 0,
      feeRange: "",
      requiredAggregate: 0,
      deadlineDate: "",
      ...initialProgram,
      isAdmissionOpen: initialProgram.isAdmissionOpen !== false,
    };
  });

  const handleSubmit = (event) => {
    event.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-slate-900">{program ? "Edit Program" : "Add Program"}</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-slate-700 mb-2 text-sm">Program Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(event) => setFormData({ ...formData, name: event.target.value })}
              placeholder="e.g., Computer Science"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-slate-700 mb-2 text-sm">Available Seats</label>
            <input
              type="number"
              value={formData.seats}
              onChange={(event) =>
                setFormData({ ...formData, seats: parseInt(event.target.value, 10) || 0 })
              }
              placeholder="e.g., 100"
              min="0"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-slate-700 mb-2 text-sm">Fee Range</label>
            <input
              type="text"
              value={formData.feeRange}
              onChange={(event) => setFormData({ ...formData, feeRange: event.target.value })}
              placeholder="e.g., PKR 400,000 - 500,000"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-slate-700 mb-2 text-sm">Required Aggregate (%)</label>
            <input
              type="number"
              value={formData.requiredAggregate}
              onChange={(event) =>
                setFormData({
                  ...formData,
                  requiredAggregate: parseFloat(event.target.value) || 0,
                })
              }
              placeholder="e.g., 75"
              min="0"
              max="100"
              step="0.01"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-slate-700 mb-2 text-sm">Application Deadline</label>
            <input
              type="date"
              value={formData.deadlineDate || ""}
              onChange={(event) =>
                setFormData({
                  ...formData,
                  deadlineDate: event.target.value,
                })
              }
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={formData.isAdmissionOpen !== false}
              onChange={(event) =>
                setFormData({
                  ...formData,
                  isAdmissionOpen: event.target.checked,
                })
              }
              className="rounded border-slate-300"
            />
            Admission Open for this program
          </label>
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {program ? "Update Program" : "Add Program"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export { FormConfiguration };
