import { readFileSync } from "node:fs";
import type { ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { beforeEach, describe, expect, it, vi } from "vitest";

import RootLayout from "../app/layout";
import SignInPage from "../app/sign-in/[[...sign-in]]/page";
import SignUpPage from "../app/sign-up/[[...sign-up]]/page";
import SessionControls from "./SessionControls";

const clerk = vi.hoisted(() => ({
  useAuth: vi.fn<() => { isLoaded: boolean; sessionId: string | null | undefined }>(),
  signOutButton: vi.fn(),
  signIn: vi.fn(),
  signUp: vi.fn(),
  provider: vi.fn(),
}));

vi.mock("@clerk/nextjs", () => ({
  useAuth: clerk.useAuth,
  SignOutButton: clerk.signOutButton,
  SignIn: clerk.signIn,
  SignUp: clerk.signUp,
  ClerkProvider: clerk.provider,
}));
vi.mock("@/components/SessionControls", async () => import("./SessionControls"));

beforeEach(() => {
  vi.clearAllMocks();
  clerk.useAuth.mockReturnValue({ isLoaded: true, sessionId: "session_active" });
  // Render children to verify our UI contract, without simulating Clerk sign-out.
  clerk.signOutButton.mockImplementation(({ children }: { children: ReactNode }) => children);
  clerk.provider.mockImplementation(({ children }: { children: ReactNode }) => children);
  clerk.signIn.mockReturnValue(null);
  clerk.signUp.mockReturnValue(null);
});

describe("authenticated session controls", () => {
  it("renders an explicit sign-out action inside the shared ClerkProvider", () => {
    const markup = renderToStaticMarkup(<RootLayout><main>MAIA</main></RootLayout>);

    expect(clerk.provider).toHaveBeenCalledOnce();
    expect(markup).toContain('aria-label="Session controls"');
    expect(markup).toContain('type="button"');
    expect(markup).toContain("Sign out</button>");
    expect(markup).toContain("<main>MAIA</main>");
    const { children } = clerk.provider.mock.calls[0][0];
    expect(children[0].type).toBe(SessionControls);
  });

  it("delegates only the active session and public redirect to Clerk, with no custom handlers", () => {
    renderToStaticMarkup(<SessionControls />);

    expect(clerk.signOutButton).toHaveBeenCalledOnce();
    const props = clerk.signOutButton.mock.calls[0][0];
    expect(Object.keys(props).sort()).toEqual(["children", "signOutOptions"]);
    expect(props.signOutOptions.sessionId).toBe("session_active");
    expect(props.signOutOptions.redirectUrl).toBe("/sign-in");
    const button = props.children as ReactElement;
    expect(button.type).toBe("button");
    expect(Object.keys(button.props as object).sort()).toEqual(["children", "style", "type"]);
  });

  it.each([
    { isLoaded: false, sessionId: undefined },
    { isLoaded: true, sessionId: null },
  ])("renders no action without a loaded Clerk session: %j", (state) => {
    clerk.useAuth.mockReturnValue(state);

    expect(renderToStaticMarkup(<SessionControls />)).toBe("");
    expect(clerk.signOutButton).not.toHaveBeenCalled();
  });

  it("removes the action when Clerk no longer reports an active session", () => {
    expect(renderToStaticMarkup(<SessionControls />)).toContain("Sign out</button>");
    clerk.useAuth.mockReturnValue({ isLoaded: true, sessionId: null });

    expect(renderToStaticMarkup(<SessionControls />)).toBe("");
    expect(clerk.signOutButton).toHaveBeenCalledOnce();
  });

  it("has no internal lifecycle dependencies or custom session side effects", () => {
    const source = ts.createSourceFile(
      "SessionControls.tsx",
      readFileSync(new URL("./SessionControls.tsx", import.meta.url), "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const imports = source.statements.filter(ts.isImportDeclaration);
    expect(imports.map((statement) =>
      (statement.moduleSpecifier as ts.StringLiteral).text,
    )).toEqual(["@clerk/nextjs"]);

    const calls: string[] = [];
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node)) {
        calls.push(node.expression.getText(source));
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    expect(calls).toEqual(["useAuth"]);
  });

  it("preserves the existing official Clerk sign-in and sign-up route components", () => {
    renderToStaticMarkup(<SignInPage />);
    renderToStaticMarkup(<SignUpPage />);

    expect(clerk.signIn).toHaveBeenCalledOnce();
    expect(clerk.signUp).toHaveBeenCalledOnce();
  });
});
