import { Navigate, Route, Routes } from 'react-router';
import { Layout } from './components/Layout';
import { ImportPage } from './pages/ImportPage';
import { InvitationsPage } from './pages/InvitationsPage';
import { InvitePage } from './pages/InvitePage';
import { LoginPage } from './pages/LoginPage';
import { PasswordPage } from './pages/PasswordPage';
import { RecipeEditPage } from './pages/RecipeEditPage';
import { RecipeNewPage } from './pages/RecipeNewPage';
import { RecipePage } from './pages/RecipePage';
import { RecipesPage } from './pages/RecipesPage';
import { SettingsPage } from './pages/SettingsPage';
import { SharePage } from './pages/SharePage';
import { TagsPage } from './pages/TagsPage';

export function App() {
  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />
      <Route path="invite/:token" element={<InvitePage />} />
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/recipes" replace />} />
        <Route path="recipes" element={<RecipesPage />} />
        <Route path="recipes/new" element={<RecipeNewPage />} />
        <Route path="recipes/:id" element={<RecipePage />} />
        <Route path="recipes/:id/edit" element={<RecipeEditPage />} />
        <Route path="import" element={<ImportPage />} />
        <Route path="share" element={<SharePage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="settings/invitations" element={<InvitationsPage />} />
        <Route path="settings/password" element={<PasswordPage />} />
        <Route path="tags" element={<TagsPage />} />
        <Route path="*" element={<Navigate to="/recipes" replace />} />
      </Route>
    </Routes>
  );
}
