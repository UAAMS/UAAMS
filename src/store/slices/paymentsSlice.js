import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { api } from "../../lib/apiClient";

export const fetchPaymentApplication = createAsyncThunk(
  "payments/fetchPaymentApplication",
  async (applicationId, { rejectWithValue }) => {
    try {
      const response = await api.get(`/applications/${applicationId}`);
      return response?.data?.application || null;
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to load application payment details.");
    }
  },
);

export const submitApplicationPayment = createAsyncThunk(
  "payments/submitApplicationPayment",
  async ({ applicationId, payload }, { rejectWithValue }) => {
    try {
      const response = await api.patch(`/applications/${applicationId}/payment`, payload);
      return response?.data?.application || null;
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to process payment.");
    }
  },
);

const paymentsSlice = createSlice({
  name: "payments",
  initialState: {
    currentApplication: null,
    loading: false,
    error: "",
    processing: false,
    processingError: "",
  },
  reducers: {
    clearPaymentErrors(state) {
      state.error = "";
      state.processingError = "";
    },
    resetPaymentState(state) {
      state.currentApplication = null;
      state.loading = false;
      state.error = "";
      state.processing = false;
      state.processingError = "";
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPaymentApplication.pending, (state) => {
        state.loading = true;
        state.error = "";
      })
      .addCase(fetchPaymentApplication.fulfilled, (state, action) => {
        state.loading = false;
        state.currentApplication = action.payload;
      })
      .addCase(fetchPaymentApplication.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Unable to load application payment details.";
      })
      .addCase(submitApplicationPayment.pending, (state) => {
        state.processing = true;
        state.processingError = "";
      })
      .addCase(submitApplicationPayment.fulfilled, (state, action) => {
        state.processing = false;
        state.currentApplication = action.payload;
      })
      .addCase(submitApplicationPayment.rejected, (state, action) => {
        state.processing = false;
        state.processingError = action.payload || "Unable to process payment.";
      });
  },
});

export const { clearPaymentErrors, resetPaymentState } = paymentsSlice.actions;
export default paymentsSlice.reducer;
