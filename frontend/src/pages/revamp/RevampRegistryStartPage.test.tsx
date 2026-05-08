import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { I18nProvider } from "../../i18n/I18nContext";
import { RevampRegistryStartPage } from "./RevampRegistryStartPage";

const saveRevampOnboardingContextMock = vi.fn();

vi.mock("../../utils/revampOnboarding", () => ({
  saveRevampOnboardingContext: (...args: unknown[]) => saveRevampOnboardingContextMock(...args)
}));

describe("RevampRegistryStartPage", () => {
  beforeEach(() => {
    saveRevampOnboardingContextMock.mockReset();
  });

  it("redirects to /apply when registry route param is invalid", async () => {
    render(
      <I18nProvider>
        <MemoryRouter initialEntries={["/apply/invalid"]}>
          <Routes>
            <Route path="/apply" element={<div>apply-route</div>} />
            <Route path="/apply/:registryType" element={<RevampRegistryStartPage />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("apply-route")).toBeInTheDocument();
    });
  });

  it("stores public onboarding context on public flow click", () => {
    render(
      <I18nProvider>
        <MemoryRouter initialEntries={["/apply/albo-a"]}>
          <Routes>
            <Route path="/register" element={<div>register-route</div>} />
            <Route path="/apply/:registryType" element={<RevampRegistryStartPage />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    );

    fireEvent.click(screen.getByRole("link", { name: "Avvia iscrizione" }));

    expect(saveRevampOnboardingContextMock).toHaveBeenCalledWith({
      registryType: "ALBO_A",
      sourceChannel: "PUBLIC"
    });
  });
});
