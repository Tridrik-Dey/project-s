import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { I18nProvider } from "../../i18n/I18nContext";
import { RevampEntryPage } from "./RevampEntryPage";

const saveRevampOnboardingContextMock = vi.fn();

vi.mock("../../utils/revampOnboarding", () => ({
  saveRevampOnboardingContext: (...args: unknown[]) => saveRevampOnboardingContextMock(...args)
}));

describe("RevampEntryPage", () => {
  beforeEach(() => {
    saveRevampOnboardingContextMock.mockReset();
  });

  it("renders both registry cards", () => {
    render(
      <I18nProvider>
        <MemoryRouter initialEntries={["/apply"]}>
          <Routes>
            <Route path="/apply" element={<RevampEntryPage />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    );

    expect(screen.getByRole("heading", { name: "Albo A - Professionisti" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Albo B - Aziende" })).toBeInTheDocument();
  });

  it("persists invite onboarding context when token query is present", () => {
    render(
      <I18nProvider>
        <MemoryRouter initialEntries={["/apply?token=ABC123&registryType=ALBO_A"]}>
          <Routes>
            <Route path="/apply" element={<RevampEntryPage />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    );

    expect(saveRevampOnboardingContextMock).toHaveBeenCalledWith({
      registryType: "ALBO_A",
      sourceChannel: "INVITE",
      inviteToken: "ABC123"
    });
  });
});
