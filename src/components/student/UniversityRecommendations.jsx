import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { School, MapPin, DollarSign, Calendar, TrendingUp } from "lucide-react";
import { onDataUpdated } from "../../lib/socketClient";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { fetchRecommendations } from "../../store/slices/recommendationsSlice";

const clampPercentage = (value) => Math.max(0, Math.min(100, Number(value || 0)));
const hasDeadlinePassed = (value) => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  date.setHours(23, 59, 59, 999);
  return date.getTime() < Date.now();
};

const resolveProgramRecommendations = (university) => {
  if (Array.isArray(university?.programRecommendations) && university.programRecommendations.length > 0) {
    return university.programRecommendations
      .filter((item) => String(item?.name || "").trim())
      .map((item) => ({
        name: String(item.name).trim(),
        requiredAggregate: Number(item.requiredAggregate || 0),
        matchScore: clampPercentage(item.matchScore),
        deadlineDate: item?.deadlineDate || null,
        deadline: item?.deadline || "Not announced",
        isAdmissionOpen: item?.isAdmissionOpen !== false,
      }))
      .sort((a, b) => b.matchScore - a.matchScore);
  }

  return (Array.isArray(university?.programs) ? university.programs : [])
    .map((program) => ({
      name: typeof program === "string" ? program : String(program?.name || ""),
      requiredAggregate: Number(university?.requiredAggregate || 0),
      matchScore: clampPercentage(university?.matchScore),
      deadlineDate: program?.deadlineDate || null,
      deadline: university?.deadline || "Not announced",
      isAdmissionOpen: program?.isAdmissionOpen !== false,
    }))
    .filter((item) => item.name);
};

function UniversityRecommendations() {
  const dispatch = useAppDispatch();
  const {
    items: universities,
    loading: recommendationsLoading,
    error: recommendationsError,
  } = useAppSelector((state) => state.recommendations);
  const [selectedFilters, setSelectedFilters] = useState({
    type: "all",
    minAggregate: 0,
    maxFee: 1000000,
  });

  useEffect(() => {
    dispatch(fetchRecommendations());
    const unsubscribe = onDataUpdated((event) => {
      if (event?.resource === "programs") {
        dispatch(fetchRecommendations({ force: true }));
      }
    });

    return () => {
      unsubscribe();
    };
  }, [dispatch]);

  const filteredUniversities = useMemo(
    () =>
      universities
        .filter((university) => {
          const programRecommendations = resolveProgramRecommendations(university);

          if (
            selectedFilters.type !== "all" &&
            String(university.type || "").toLowerCase() !== selectedFilters.type
          ) {
            return false;
          }

          if (
            programRecommendations.length > 0 &&
            !programRecommendations.some(
              (program) => Number(program.requiredAggregate || 0) >= selectedFilters.minAggregate,
            )
          ) {
            return false;
          }

          if (Number(university.applicationFee || 0) > selectedFilters.maxFee) {
            return false;
          }

          return true;
        })
        .sort((a, b) => {
          const bestA = Math.max(
            Number(a.matchScore || 0),
            ...resolveProgramRecommendations(a).map((item) => Number(item.matchScore || 0)),
          );
          const bestB = Math.max(
            Number(b.matchScore || 0),
            ...resolveProgramRecommendations(b).map((item) => Number(item.matchScore || 0)),
          );
          return bestB - bestA;
        }),
    [universities, selectedFilters],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-slate-900 mb-2">University Recommendations</h1>
        <p className="text-slate-600">Universities matched based on your academic profile (real-time updates enabled)</p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h3 className="text-slate-900 mb-4">Filter Universities</h3>
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="block text-slate-700 mb-2 text-sm">University Type</label>
            <select
              value={selectedFilters.type}
              onChange={(event) =>
                setSelectedFilters({ ...selectedFilters, type: event.target.value })
              }
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All Universities</option>
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
          </div>
          <div>
            <label className="block text-slate-700 mb-2 text-sm">Minimum Aggregate</label>
            <input
              type="number"
              value={selectedFilters.minAggregate}
              onChange={(event) =>
                setSelectedFilters({
                  ...selectedFilters,
                  minAggregate: parseInt(event.target.value, 10) || 0,
                })
              }
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="e.g., 70"
            />
          </div>
          <div>
            <label className="block text-slate-700 mb-2 text-sm">Maximum Fee (PKR)</label>
            <input
              type="number"
              value={selectedFilters.maxFee}
              onChange={(event) =>
                setSelectedFilters({
                  ...selectedFilters,
                  maxFee: parseInt(event.target.value, 10) || 1000000,
                })
              }
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="e.g., 5000"
            />
          </div>
        </div>
      </div>

      

      {recommendationsLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Loading recommendations...
        </div>
      ) : null}

      {!recommendationsLoading && recommendationsError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {recommendationsError}
        </div>
      ) : null}

      {!recommendationsLoading && !recommendationsError && filteredUniversities.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          No universities found for current filters.
        </div>
      ) : null}

      <div className="space-y-4">
        {filteredUniversities.map((university) => (
          <UniversityCard key={university.id} university={university} />
        ))}
      </div>
    </div>
  );
}

function UniversityCard({ university }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const programRecommendations = useMemo(
    () => resolveProgramRecommendations(university),
    [university],
  );
  const bestProgramMatch = useMemo(
    () =>
      programRecommendations.reduce(
        (best, item) => (item.matchScore > best.matchScore ? item : best),
        { matchScore: Number(university.matchScore || 0), requiredAggregate: Number(university.requiredAggregate || 0) },
      ),
    [programRecommendations, university.matchScore, university.requiredAggregate],
  );

  const handleApplyClick = (program) => {
    navigate(`/student/apply/${university.id}?program=${encodeURIComponent(program)}`);
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center shrink-0">
                <School className="w-6 h-6 text-emerald-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-slate-900 mb-1">{university.name}</h3>
                <div className="flex items-center gap-4 text-sm text-slate-600">
                  <div className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {university.location}
                  </div>
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs capitalize">
                    {university.type}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-emerald-600 mb-1">Best Program Match</div>
            <div className="text-3xl text-emerald-700">{Number(bestProgramMatch.matchScore || 0)}%</div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-4">
          <InfoItem
            icon={<DollarSign className="w-4 h-4" />}
            label="Application Fee"
            value={`PKR ${Number(university.applicationFee || 0).toLocaleString()}`}
          />
          <InfoItem
            icon={<TrendingUp className="w-4 h-4" />}
            label="Minimum Required Aggregate"
            value={`${Number(bestProgramMatch.requiredAggregate || 0)}%+`}
          />
          <InfoItem
            icon={<Calendar className="w-4 h-4" />}
            label="Deadline"
            value={university.deadline || "Not announced"}
          />
        </div>

        {expanded ? (
          <div className="border-t border-slate-200 pt-4 mt-4">
            <h4 className="text-slate-900 mb-2">Program-wise Recommendations</h4>
            <div className="space-y-2 mb-4">
              {programRecommendations.map((program) => (
                <div
                  key={`${university.id}-${program.name}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                >
                  {(() => {
                    const isClosedByUniversity = program.isAdmissionOpen === false;
                    const isPastDeadline = hasDeadlinePassed(program.deadlineDate);
                    const isApplyDisabled = isClosedByUniversity || isPastDeadline;
                    const statusLabel = isClosedByUniversity
                      ? "Admission Closed"
                      : isPastDeadline
                        ? "Deadline Passed"
                        : "Admission Open";

                    return (
                      <>
                        <div>
                          <div className="text-sm text-slate-900">{program.name}</div>
                          <div className="text-xs text-slate-600">
                            Min Aggregate: {Number(program.requiredAggregate || 0)}%
                          </div>
                          <div className="text-xs text-slate-600">
                            Deadline: {program.deadline || "Not announced"}
                          </div>
                          <div className="mt-1 text-xs">
                            <span
                              className={`rounded-full px-2 py-1 ${
                                isApplyDisabled
                                  ? "bg-red-100 text-red-700"
                                  : "bg-emerald-100 text-emerald-700"
                              }`}
                            >
                              {statusLabel}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-700">
                            Match {Number(program.matchScore || 0)}%
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleApplyClick(program.name)}
                              disabled={isApplyDisabled}
                              className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isApplyDisabled ? "Unavailable" : "Apply Now"}
                            </button>
                            
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              ))}
            </div>
           
          </div>
        ) : null}

        <button
          onClick={() => setExpanded((previous) => !previous)}
          className="mt-4 text-emerald-600 hover:text-emerald-700 text-sm"
        >
          {expanded ? "Show Less" : "Show More Details"} {"->"}
        </button>
      </div>
    </div>
  );
}

function InfoItem({ icon, label, value }) {
  return (
    <div className="flex items-start gap-2">
      <div className="text-slate-400 mt-1">{icon}</div>
      <div>
        <div className="text-slate-600 text-xs">{label}</div>
        <div className="text-slate-900 text-sm">{value}</div>
      </div>
    </div>
  );
}

export { UniversityRecommendations };
