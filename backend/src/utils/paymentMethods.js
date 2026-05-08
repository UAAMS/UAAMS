const ALLOWED_PAYMENT_TYPES = new Set(["bank", "wallet", "card", "other"]);

const normalizePaymentMethods = (paymentMethods = []) => {
  if (!Array.isArray(paymentMethods)) {
    return [];
  }

  return paymentMethods
    .map((method) => {
      const type = String(method?.type || "bank").toLowerCase();
      return {
        id: String(method?._id || method?.id || ""),
        type: ALLOWED_PAYMENT_TYPES.has(type) ? type : "bank",
        title: String(method?.title || "").trim(),
        accountTitle: String(method?.accountTitle || "").trim(),
        bankName: String(method?.bankName || "").trim(),
        accountNumber: String(method?.accountNumber || "").trim(),
        iban: String(method?.iban || "").trim(),
        walletName: String(method?.walletName || "").trim(),
        walletNumber: String(method?.walletNumber || "").trim(),
        instructions: String(method?.instructions || "").trim(),
        isActive: method?.isActive !== false,
      };
    })
    .filter(
      (method) =>
        method.title ||
        method.accountTitle ||
        method.bankName ||
        method.accountNumber ||
        method.iban ||
        method.walletName ||
        method.walletNumber ||
        method.instructions,
    );
};

module.exports = {
  normalizePaymentMethods,
};
