import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { School, MapPin, DollarSign, Calendar, ChevronRight } from "lucide-react";
import { onDataUpdated } from "../../lib/socketClient";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import {
  fetchModelRecommendations,
  fetchRecommendations,
} from "../../store/slices/recommendationsSlice";

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
        minimumFscPercentage: Number(item.minimumFscPercentage || 0),
        minimumMatricPercentage: Number(item.minimumMatricPercentage || 0),
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
      minimumFscPercentage: Number(university?.minimumFscPercentage || program?.minimumFscPercentage || 0),
      minimumMatricPercentage: Number(university?.minimumMatricPercentage || program?.minimumMatricPercentage || 0),
      matchScore: clampPercentage(university?.matchScore),
      deadlineDate: program?.deadlineDate || null,
      deadline: university?.deadline || "Not announced",
      isAdmissionOpen: program?.isAdmissionOpen !== false,
    }))
    .filter((item) => item.name);
};

const formatEligibilityCriteria = (program) =>
  `FSC ${Number(program?.minimumFscPercentage || 0)}%+ | Matric ${Number(
    program?.minimumMatricPercentage || 0,
  )}%+`;

const meetsEligibilityCriteria = (program, profileBasis = {}) => {
  const studentFsc = Number(profileBasis?.interPercentage || 0);
  const studentMatric = Number(profileBasis?.matricPercentage || 0);
  return (
    studentFsc >= Number(program?.minimumFscPercentage || 0) &&
    studentMatric >= Number(program?.minimumMatricPercentage || 0)
  );
};

function UniversityRecommendations() {
  const dispatch = useAppDispatch();
  const {
    items: universities,
    profileBasis,
    modelItems,
    modelUserInput,
    modelMessage,
    modelLoading,
    modelError,
    loading: recommendationsLoading,
    error: recommendationsError,
  } = useAppSelector((state) => state.recommendations);
  const [selectedFilters, setSelectedFilters] = useState({
    type: "all",
    maxFee: "",
  });

  useEffect(() => {
    dispatch(fetchRecommendations());
    dispatch(fetchModelRecommendations());
    const unsubscribe = onDataUpdated((event) => {
      if (event?.resource === "programs") {
        dispatch(fetchRecommendations({ force: true }));
      }
    });

    return () => {
      unsubscribe();
    };
  }, [dispatch]);

  const filteredUniversities = useMemo(() => {
    const maximumFee =
      selectedFilters.maxFee === "" ? Number.MAX_SAFE_INTEGER : Number(selectedFilters.maxFee);

    return universities
      .map((university) => {
        const programRecommendations = resolveProgramRecommendations(university);

        return {
          university,
          filteredProgramRecommendations: programRecommendations,
        };
      })
      .filter(({ university, filteredProgramRecommendations }) => {
        if (
          selectedFilters.type !== "all" &&
          String(university.type || "").toLowerCase() !== selectedFilters.type
        ) {
          return false;
        }

        if (Number(university.applicationFee || 0) > maximumFee) {
          return false;
        }

        return filteredProgramRecommendations.length > 0;
      })
      .sort((a, b) => {
        const bestA = Math.max(
          Number(a.university.matchScore || 0),
          ...a.filteredProgramRecommendations.map((item) => Number(item.matchScore || 0)),
        );
        const bestB = Math.max(
          Number(b.university.matchScore || 0),
          ...b.filteredProgramRecommendations.map((item) => Number(item.matchScore || 0)),
        );
        return bestB - bestA;
      });
  }, [universities, selectedFilters]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-2 text-2xl font-semibold text-slate-900 sm:text-3xl">
          University Recommendations
        </h1>
        <p className="text-sm text-slate-600 sm:text-base">
          Universities matched based on your academic profile (real-time updates enabled)
        </p>
      </div>

      <ModelRecommendationPanel
        items={modelItems}
        userInput={modelUserInput}
        message={modelMessage}
        loading={modelLoading}
        error={modelError}
      />

      <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-6">
        <h3 className="mb-4 text-base font-semibold text-slate-900">Filter Universities</h3>
        <div className="grid gap-4 md:grid-cols-2">
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
            <label className="block text-slate-700 mb-2 text-sm">Maximum Fee (PKR)</label>
            <input
              type="number"
              value={selectedFilters.maxFee}
              onChange={(event) =>
                setSelectedFilters({
                  ...selectedFilters,
                  maxFee: event.target.value,
                })
              }
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="e.g., 5000"
              min="0"
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
        {filteredUniversities.map(({ university, filteredProgramRecommendations }) => (
          <UniversityCard
            key={university.id}
            university={university}
            filteredPrograms={filteredProgramRecommendations}
            profileBasis={profileBasis}
          />
        ))}
      </div>
    </div>
  );
}

function ModelRecommendationPanel({
  items,
  userInput,
  message,
  loading,
  error,
}) {
  const navigate = useNavigate();
  const matric = Number(userInput?.matric || 0);
  const fsc = Number(userInput?.fsc || 0);
  const handleApplyClick = (item) => {
    const universityId = String(item?.universityId || "").trim();
    const programName = String(item?.applyProgramName || item?.programName || item?.program || "").trim();
    if (!universityId || !programName || item?.canApply === false) return;
    navigate(`/student/apply/${universityId}?program=${encodeURIComponent(programName)}`);
  };

  return (
    <div className="rounded-lg border border-emerald-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            Model recommendations
          </div>
          <h2 className="text-lg font-semibold text-slate-900">Best Programs From Your Marks</h2>
          <p className="mt-1 text-sm text-slate-600">
            Based on matric {matric.toFixed(2)}% and inter {fsc.toFixed(2)}% saved in your profile.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          Loading model recommendations...
        </p>
      ) : null}

      {!loading && error ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {error}
        </p>
      ) : null}

      {!loading && !error && message ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          {message}
        </p>
      ) : null}

      {!loading && !error && !message && items.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((item) => (
            <div
              key={`${item.id}-${item.programName}`}
              className="rounded-lg border border-slate-200 bg-slate-50 p-4"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">{item.programName}</h3>
                  <p className="text-xs text-slate-600">{item.campus || item.program}</p>
                </div>
                <span
                  className="rounded-full px-2 py-1 text-xs font-medium text-white"
                  style={{ backgroundColor: item.colorCode }}
                >
                  {item.chance || "Matched"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <Metric label="Predicted" value={`${item.predictedAggregate}%`} />
                <Metric label="Closing" value={`${item.closingMerit}%`} />
                <Metric label="Gap" value={`${item.difference}%`} />
              </div>
              {item.recommendationText ? (
                <p className="mt-3 text-xs text-slate-600">{item.recommendationText}</p>
              ) : null}
              <button
                type="button"
                onClick={() => handleApplyClick(item)}
                disabled={!item.universityId || item.canApply === false}
                className="mt-4 inline-flex w-full items-center justify-center rounded-md bg-emerald-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {!item.universityId
                  ? "University Not Linked"
                  : item.canApply === false
                    ? "Unavailable"
                    : "Apply Now"}
              </button>
            </div>
          ))}
        </div>
      ) : null}

      
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-md bg-white px-2 py-2">
      <div className="text-slate-500">{label}</div>
      <div className="font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function UniversityCard({ university, filteredPrograms, profileBasis }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const logoUrl = university.logo || university.representativeProfilePicture || "";
  const programRecommendations = useMemo(
    () => filteredPrograms ?? resolveProgramRecommendations(university),
    [filteredPrograms, university],
  );
  const eligibilitySummary = useMemo(
    () =>
      programRecommendations.length > 0
        ? formatEligibilityCriteria({
            minimumFscPercentage: Math.min(
              ...programRecommendations.map((program) => Number(program.minimumFscPercentage || 0)),
            ),
            minimumMatricPercentage: Math.min(
              ...programRecommendations.map((program) => Number(program.minimumMatricPercentage || 0)),
            ),
          })
        : "Not configured",
    [programRecommendations],
  );

  const handleApplyClick = (program) => {
    navigate(`/student/apply/${university.id}?program=${encodeURIComponent(program)}`);
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow">
      <div className="p-6">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-emerald-100">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={`${university.name} logo`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <School className="h-6 w-6 text-emerald-600" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-slate-900 mb-1">{university.name}</h3>
                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
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
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-4">
          <InfoItem
            icon={<DollarSign className="w-4 h-4" />}
            label="Application Fee"
            value={`PKR ${Number(university.applicationFee || 0).toLocaleString()}`}
          />
          <InfoItem
            icon={<School className="w-4 h-4" />}
            label="Eligibility Criteria"
            value={eligibilitySummary}
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
                    const isEligible = meetsEligibilityCriteria(program, profileBasis);
                    const isApplyDisabled = isClosedByUniversity || isPastDeadline || !isEligible;
                    const statusLabel = isClosedByUniversity
                      ? "Admission Closed"
                      : isPastDeadline
                        ? "Deadline Passed"
                        : !isEligible
                          ? "Not Eligible"
                          : "Admission Open";

                    return (
                      <>
                        <div>
                          <div className="text-sm text-slate-900">{program.name}</div>
                          <div className="text-xs text-slate-600">
                            Eligibility: {formatEligibilityCriteria(program)}
                          </div>
                          {!isEligible ? (
                            <div className="text-xs text-red-600">
                              Your profile marks are below the required criteria.
                            </div>
                          ) : null}
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
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleApplyClick(program.name)}
                              disabled={isApplyDisabled}
                              className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {!isEligible ? "Not Eligible" : isApplyDisabled ? "Unavailable" : "Apply Now"}
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
          type="button"
          onClick={() => setExpanded((previous) => !previous)}
          className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 mt-4"
        >
          {expanded ? "Show Less" : "Show More Details"}
          <ChevronRight className="w-4 h-4" />
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
