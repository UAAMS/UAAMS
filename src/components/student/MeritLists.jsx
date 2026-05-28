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
import { Avatar } from "../shared/Avatar";
import { downloadPdfDocument } from "../../lib/pdfDownload";
import { onDataUpdated } from "../../lib/socketClient";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { fetchStudentMeritLists } from "../../store/slices/meritListsSlice";

const getMeritListPdf = (meritList) => {
  const visibleEntries = meritList.entries.filter((entry) => entry.status !== "rejected");
  const lines = [
    "Official Merit List",
    "===================",
    "",
    `University       : ${meritList.university}`,
    `Program          : ${meritList.program}`,
    `Session          : ${meritList.session}`,
    `Merit List       : ${meritList.listNumber}`,
    `Published        : ${meritList.publishedDate}`,
    `Admission Seats  : ${meritList.totalSeats}`,
    "",
    "Position  Roll Number        Student Name                  Aggregate  Result",
    "--------  -----------------  ----------------------------  ---------  ----------------",
    ...visibleEntries.map(
      (entry) =>
        `${String(`#${entry.meritPosition}`).padEnd(8)}  ${String(entry.rollNumber).padEnd(
          17,
        )}  ${String(entry.studentName).slice(0, 28).padEnd(28)}  ${String(
          `${entry.aggregate}%`,
        ).padEnd(9)}  ${
          entry.status === "selected"
            ? "Selected for Admission Letter"
            : "Not Eligible for Admission Letter"
        }`,
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
        <h1 className="uaams-page-title">Merit Lists</h1>
        <p className="uaams-page-description">View published admission-letter merit lists from universities.</p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-4 sm:p-6">
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
        <div className="grid gap-4 lg:grid-cols-2">
          {filteredMeritLists.length === 0 ? (
            <div className="bg-white rounded-lg border border-slate-200 p-8 text-center lg:col-span-2">
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
    <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>{icon}</div>
      <div className="text-slate-600 text-sm">{label}</div>
      <div className="text-slate-900 text-2xl">{count}</div>
    </div>
  );
}

function MeritListCard({ meritList, onView, onDownload }) {
  return (
    <article className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <div className="border-l-4 border-emerald-500 p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
          {meritList.universityLogo ? (
            <Avatar
              src={meritList.universityLogo}
              name={meritList.university}
              size="lg"
              className="rounded-lg bg-white"
            />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
              <Award className="w-6 h-6 text-emerald-600" />
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-emerald-600">{meritList.university}</span>
            </div>
            <h3 className="mb-1 break-words font-semibold text-slate-900">{meritList.program}</h3>
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <span>{meritList.session}</span>
              <span>|</span>
              <span>Merit List {meritList.listNumber}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3">
        <div>
          <div className="text-slate-600 text-sm">Total Seats</div>
          <div className="text-slate-900">{meritList.totalSeats}</div>
        </div>
        <div>
          <div className="text-slate-600 text-sm">Published</div>
          <div className="text-slate-900 text-sm">{meritList.publishedDate}</div>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onView}
          className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white transition-colors hover:bg-emerald-700"
        >
          View Details
        </button>
        <button
          type="button"
          onClick={onDownload}
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50"
          title="Download merit list PDF"
        >
          <Download className="w-4 h-4" />
        </button>
      </div>
      </div>
    </article>
  );
}

function MeritListDetailModal({ meritList, onClose, onDownload }) {
  const [searchRollNumber, setSearchRollNumber] = useState("");

  const filteredEntries = useMemo(() => {
    const search = searchRollNumber.trim().toLowerCase();
    return meritList.entries.filter(
      (entry) =>
        entry.status !== "rejected" &&
        (!search ||
          entry.rollNumber.toLowerCase().includes(search) ||
          entry.studentName.toLowerCase().includes(search)),
    );
  }, [meritList.entries, searchRollNumber]);

  return (
    <div className="uaams-modal-backdrop fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-200">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                {meritList.universityLogo ? (
                  <Avatar
                    src={meritList.universityLogo}
                    name={meritList.university}
                    size="sm"
                    className="rounded-lg bg-white"
                  />
                ) : (
                  <School className="w-5 h-5 text-emerald-600" />
                )}
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

          <div className="flex flex-col gap-3 sm:flex-row">
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
              className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-white transition-colors hover:bg-emerald-700"
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
                className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"
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
                <div className="flex flex-wrap items-center gap-4">
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
                        Not Eligible
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
