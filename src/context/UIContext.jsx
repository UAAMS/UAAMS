import { createContext, useContext, useMemo, useReducer } from "react";

const initialState = {
  loadingKeys: {},
  modals: {},
  layout: {
    dashboardSidebarOpen: false,
  },
};

const UIContext = createContext(null);

const reducer = (state, action) => {
  switch (action.type) {
    case "START_LOADING": {
      const key = String(action.payload || "global");
      return {
        ...state,
        loadingKeys: {
          ...state.loadingKeys,
          [key]: (state.loadingKeys[key] || 0) + 1,
        },
      };
    }
    case "STOP_LOADING": {
      const key = String(action.payload || "global");
      const nextValue = Math.max(0, (state.loadingKeys[key] || 0) - 1);
      return {
        ...state,
        loadingKeys: {
          ...state.loadingKeys,
          [key]: nextValue,
        },
      };
    }
    case "OPEN_MODAL": {
      const { key, payload } = action.payload || {};
      if (!key) return state;
      return {
        ...state,
        modals: {
          ...state.modals,
          [key]: { open: true, payload: payload || null },
        },
      };
    }
    case "CLOSE_MODAL": {
      const key = String(action.payload || "");
      if (!key) return state;
      return {
        ...state,
        modals: {
          ...state.modals,
          [key]: { open: false, payload: null },
        },
      };
    }
    case "SET_LAYOUT": {
      const { key, value } = action.payload || {};
      if (!key) return state;
      return {
        ...state,
        layout: {
          ...state.layout,
          [key]: value,
        },
      };
    }
    default:
      return state;
  }
};

export const UIProvider = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  const value = useMemo(() => {
    const isLoading = Object.values(state.loadingKeys).some((count) => Number(count || 0) > 0);
    return {
      loadingKeys: state.loadingKeys,
      isLoading,
      modals: state.modals,
      layout: state.layout,
      startLoading: (key = "global") => dispatch({ type: "START_LOADING", payload: key }),
      stopLoading: (key = "global") => dispatch({ type: "STOP_LOADING", payload: key }),
      openModal: (key, payload = null) =>
        dispatch({ type: "OPEN_MODAL", payload: { key, payload } }),
      closeModal: (key) => dispatch({ type: "CLOSE_MODAL", payload: key }),
      setLayoutValue: (key, value) =>
        dispatch({ type: "SET_LAYOUT", payload: { key, value } }),
    };
  }, [state.layout, state.loadingKeys, state.modals]);

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
};

export const useUI = () => {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error("useUI must be used inside UIProvider");
  }
  return context;
};
