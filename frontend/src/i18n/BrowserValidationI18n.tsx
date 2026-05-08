import { useEffect } from "react";
import { useI18n } from "./I18nContext";

type ValidatableElement = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function isValidatableElement(target: EventTarget | null): target is ValidatableElement {
  return target instanceof HTMLInputElement
    || target instanceof HTMLSelectElement
    || target instanceof HTMLTextAreaElement;
}

export function BrowserValidationI18n() {
  const { language, t } = useI18n();

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    const handleInvalid = (event: Event) => {
      const target = event.target;
      if (!isValidatableElement(target)) return;

      // Keep explicit field-level custom errors (set by form submit logic).
      if (target.validity.customError) return;

      target.setCustomValidity("");

      if (target.validity.valueMissing) {
        target.setCustomValidity(t("validation.browser.required"));
        return;
      }

      if (
        target instanceof HTMLInputElement
        && target.type === "email"
        && target.validity.typeMismatch
      ) {
        target.setCustomValidity(t("validation.browser.email"));
        return;
      }

      if (target.validity.patternMismatch) {
        target.setCustomValidity(t("validation.browser.pattern"));
      }
    };

    const handleInputChange = (event: Event) => {
      const target = event.target;
      if (!isValidatableElement(target)) return;
      target.setCustomValidity("");
    };

    document.addEventListener("invalid", handleInvalid, true);
    document.addEventListener("input", handleInputChange, true);
    document.addEventListener("change", handleInputChange, true);

    return () => {
      document.removeEventListener("invalid", handleInvalid, true);
      document.removeEventListener("input", handleInputChange, true);
      document.removeEventListener("change", handleInputChange, true);
    };
  }, [t]);

  return null;
}
