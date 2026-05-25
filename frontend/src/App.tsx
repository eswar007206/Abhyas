import { Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/lib/auth";
import { ProtectedRoute } from "@/components/protected-route";
import { Toaster } from "@/components/ui/sonner";
import HomePage from "@/pages/HomePage";
import LoginPage from "@/pages/LoginPage";
import DeveloperPage from "@/pages/DeveloperPage";
import AdminPage from "@/pages/AdminPage";
import StudentPage from "@/pages/StudentPage";
import ExamHubPage from "@/pages/ExamHubPage";
import PracticePage from "@/pages/PracticePage";
import RankingsPage from "@/pages/RankingsPage";
import TestPage from "@/pages/TestPage";
import NotFoundPage from "@/pages/NotFoundPage";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/developer"
          element={
            <ProtectedRoute roles={["developer"]}>
              <DeveloperPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute roles={["organization_admin"]}>
              <AdminPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/student"
          element={
            <ProtectedRoute roles={["student", "organization_admin", "developer"]}>
              <StudentPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/exams/:examSlug"
          element={
            <ProtectedRoute roles={["student", "organization_admin", "developer"]}>
              <ExamHubPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/exams/:examSlug/practice"
          element={
            <ProtectedRoute roles={["student", "organization_admin", "developer"]}>
              <PracticePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/exams/:examSlug/rankings"
          element={
            <ProtectedRoute roles={["student", "organization_admin", "developer"]}>
              <RankingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/test/:testId"
          element={
            <ProtectedRoute roles={["student", "organization_admin", "developer"]}>
              <TestPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <Toaster />
    </AuthProvider>
  );
}
