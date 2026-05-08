import { useEffect, useMemo, useState } from "react";
import {
  Award,
  CheckCircle,
  Download,
  FileText,
  Filter,
  School,
  Search,
  XCircle,
} from "lucide-react";
import { downloadPdfDocument } from "../../lib/pdfDownload";
import { onDataUpdated } from "../../lib/socketClient";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { fetchStudentMeritLists } from "../../store/slices/meritListsSlice";

const getMeritListPdf = (meritList) => {
  const lines = [
    `University: ${meritList.university}`,
    `Program: ${meritList.program}`,
    `Session: ${meritList.session}`,
    `Merit List: ${meritList.listNumber}`,
    `Published: ${meritList.publishedDate}`,
    `Total Selected: ${meritList.totalSeats}`,
    "",
    "Entries",
    "------------------------------------------------------------",
    ...meritList.entries.map(
      (entry) =>
        `#${entry.meritPosition} | ${entry.rollNumber} | ${entry.studentName} | ${entry.aggregate}% | ${entry.status}`,
    ),
  ];

  downloadPdfDocument({
    title: `${meritList.university} - ${meritList.program} Merit List`,
    fileName: `${meritList.university}-${meritList.program}-merit-list-${meritList.listNumber}.pdf`,
    lines,
  });
};

function MeritLists() {
  const dispatch = useAppDispatch();
  const {
    items: meritLists,
    loading: isLoading,
    error,
  } = useAppSelector((state) => state.meritLists);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUniversity, setSelectedUniversity] = useState("all");
  const [selectedList, setSelectedList] = useState(null);

  useEffect(() => {
    dispatch(fetchStudentMeritLists());
    const unsubscribe = onDataUpdated((event) => {
      if (event?.resource === "merit-lists" || event?.resource === "applications") {
        dispatch(fetchStudentMeritLists());
      }
    });

    return () => {
      unsubscribe();
    };
  }, [dispatch]);

  const universities = useMemo(
    () => ["all", ...Array.from(new Set(meritLists.map((list) => list.university)))],
    [meritLists],
  );

  const filteredMeritLists = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return meritLists.filter((list) => {
      const matchesUniversity = selectedUniversity === "all" || list.university === selectedUniversity;
      const matchesSearch =
        !search ||
        list.university.toLowerCase().includes(search) ||
        list.program.toLowerCase().includes(search) ||
        list.session.toLowerCase().includes(search);
      return matchesUniversity && matchesSearch;
    });
  }, [meritLists, selectedUniversity, searchTerm]);

  const stats = useMemo(
    () => ({
      total: meritLists.length,
      universities: universities.length - 1,
      programs: Array.from(new Set(meritLists.map((item) => item.program))).length,
      seats: meritLists.reduce((accumulator, item) => accumulator + Number(item.totalSeats || 0), 0),
    }),
    [meritLists, universities],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-slate-900 mb-2">Merit Lists</h1>
        <p className="text-slate-600">View published merit lists from universities (real-time updates enabled)</p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-slate-700 mb-2 text-sm">
              <Filter className="w-4 h-4 inline mr-2" />
              Filter by University
            </label>
            <select
              value={selectedUniversity}
              onChange={(event) => setSelectedUniversity(event.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All Universities</option>
              {universities
                .filter((university) => university !== "all")
                .map((university) => (
                  <option key={university} value={university}>
                    {university}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="block text-slate-700 mb-2 text-sm">
              <Search className="w-4 h-4 inline mr-2" />
              Search
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by university or program..."
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <StatCard icon={<FileText className="w-5 h-5 text-blue-600" />} label="Total Lists" count={stats.total} color="bg-blue-50" />
        <StatCard icon={<School className="w-5 h-5 text-purple-600" />} label="Universities" count={stats.universities} color="bg-purple-50" />
        <StatCard icon={<Award className="w-5 h-5 text-emerald-600" />} label="Programs" count={stats.programs} color="bg-emerald-50" />
        <StatCard icon={<CheckCircle className="w-5 h-5 text-amber-600" />} label="Total Seats" count={stats.seats} color="bg-amber-50" />
      </div>

      {isLoading ? (
        <div className="bg-white rounded-lg border border-slate-200 p-12 text-center text-sm text-slate-600">
          Loading merit lists...
        </div>
      ) : null}

      {!isLoading && error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : null}

      {!isLoading && !error ? (
        <div className="grid md:grid-cols-2 gap-6">
          {filteredMeritLists.length === 0 ? (
            <div className="col-span-2 bg-white rounded-lg border border-slate-200 p-12 text-center">
              <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-slate-900 mb-2">No Merit Lists Found</h3>
              <p className="text-slate-600 text-sm">Try adjusting your filters or search terms.</p>
            </div>
          ) : (
            filteredMeritLists.map((list) => (
              <MeritListCard
                key={list.id}
                meritList={list}
                onView={() => setSelectedList(list)}
                onDownload={() => getMeritListPdf(list)}
              />
            ))
          )}
        </div>
      ) : null}

      {selectedList ? (
        <MeritListDetailModal
          meritList={selectedList}
          onClose={() => setSelectedList(null)}
          onDownload={() => getMeritListPdf(selectedList)}
        />
      ) : null}
    </div>
  );
}

function StatCard({ icon, label, count, color }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <div className={`w-10 h-10 ${color} rounded-lg flex items-center justify-center mb-3`}>{icon}</div>
      <div className="text-slate-600 text-sm">{label}</div>
      <div className="text-slate-900 text-2xl">{count}</div>
    </div>
  );
}

function MeritListCard({ meritList, onView, onDownload }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 bg-emerald-50 rounded-lg flex items-center justify-center">
            <Award className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <School className="w-4 h-4 text-emerald-600" />
              <span className="text-emerald-600">{meritList.university}</span>
            </div>
            <h3 className="text-slate-900 mb-1">{meritList.program}</h3>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <span>{meritList.session}</span>
              <span>|</span>
              <span>Merit List {meritList.listNumber}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4 p-3 bg-slate-50 rounded-lg">
        <div>
          <div className="text-slate-600 text-sm">Total Seats</div>
          <div className="text-slate-900">{meritList.totalSeats}</div>
        </div>
        <div>
          <div className="text-slate-600 text-sm">Published</div>
          <div className="text-slate-900 text-sm">{meritList.publishedDate}</div>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onView}
          className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm"
        >
          View Details
        </button>
        <button
          type="button"
          onClick={onDownload}
          className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm"
          title="Download merit list PDF"
        >
          <Download className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function MeritListDetailModal({ meritList, onClose, onDownload }) {
  const [searchRollNumber, setSearchRollNumber] = useState("");

  const filteredEntries = useMemo(() => {
    const search = searchRollNumber.trim().toLowerCase();
    return meritList.entries.filter(
      (entry) =>
        !search ||
        entry.rollNumber.toLowerCase().includes(search) ||
        entry.studentName.toLowerCase().includes(search),
    );
  }, [meritList.entries, searchRollNumber]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <School className="w-5 h-5 text-emerald-600" />
                <span className="text-emerald-600">{meritList.university}</span>
                <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs">
                  Merit List {meritList.listNumber}
                </span>
              </div>
              <h2 className="text-slate-900 mb-1">{meritList.program}</h2>
              <p className="text-slate-600 text-sm">
                {meritList.session} | Published {meritList.publishedDate}
              </p>
            </div>
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
              x
            </button>
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <input
                type="text"
                value={searchRollNumber}
                onChange={(event) => setSearchRollNumber(event.target.value)}
                placeholder="Search by roll number or name..."
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <button
              type="button"
              onClick={onDownload}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-3">
            {filteredEntries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-slate-200 rounded-lg flex items-center justify-center">
                    <span className="text-slate-700">#{entry.meritPosition}</span>
                  </div>
                  <div>
                    <div className="text-slate-900">{entry.studentName}</div>
                    <div className="text-slate-600 text-sm">{entry.rollNumber}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-slate-900">{entry.aggregate}%</div>
                    <div className="text-slate-600 text-sm">Aggregate</div>
                  </div>
                  <div>
                    {entry.status === "selected" ? (
                      <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" />
                        Selected
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm flex items-center gap-1">
                        <XCircle className="w-4 h-4" />
                        Not Selected
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export { MeritLists };
