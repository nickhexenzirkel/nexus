import { createBrowserRouter, Outlet } from "react-router";
import { AuthProvider } from "./components/AuthContext";
import { MainLayout } from "./components/MainLayout";
import { Feed } from "./pages/Feed";
import { Profile } from "./pages/Profile";
import { Login } from "./pages/Login";
import { NotFound } from "./pages/NotFound";
import { Chat } from "./pages/Chat";
import { Notifications } from "./pages/Notifications";
import { Notes } from "./pages/Notes";
import { PostDetail } from "./pages/PostDetail";
import { Explore } from "./pages/Explore";

// Root wrapper — AuthProvider must live inside the router tree so React Router's
// rendering context can access it in all route components.
function AuthRoot() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: AuthRoot,
    children: [
      {
        path: "login",
        Component: Login,
      },
      {
        path: "/",
        Component: MainLayout,
        children: [
          { index: true, Component: Feed },
          { path: "explore", Component: Explore },
          { path: "profile/:userId", Component: Profile },
          { path: "notifications", Component: Notifications },
          { path: "chat", Component: Chat },
          { path: "chat/:partnerId", Component: Chat },
          { path: "notes", Component: Notes },
          { path: "post/:postId", Component: PostDetail },
          { path: "*", Component: NotFound },
        ],
      },
    ],
  },
]);