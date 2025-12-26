import ChapterReport from './pages/ChapterReport';
import Contact from './pages/Contact';
import Criteria from './pages/Criteria';
import Dashboard from './pages/Dashboard';
import Evaluate from './pages/Evaluate';
import EvaluateChapter from './pages/EvaluateChapter';
import History from './pages/History';
import Home from './pages/Home';
import ManuscriptDashboard from './pages/ManuscriptDashboard';
import Pricing from './pages/Pricing';
import Privacy from './pages/Privacy';
import Revise from './pages/Revise';
import ScreenplayFormatter from './pages/ScreenplayFormatter';
import SpineReport from './pages/SpineReport';
import Terms from './pages/Terms';
import UploadManuscript from './pages/UploadManuscript';
import ViewReport from './pages/ViewReport';
import __Layout from './Layout.jsx';


export const PAGES = {
    "ChapterReport": ChapterReport,
    "Contact": Contact,
    "Criteria": Criteria,
    "Dashboard": Dashboard,
    "Evaluate": Evaluate,
    "EvaluateChapter": EvaluateChapter,
    "History": History,
    "Home": Home,
    "ManuscriptDashboard": ManuscriptDashboard,
    "Pricing": Pricing,
    "Privacy": Privacy,
    "Revise": Revise,
    "ScreenplayFormatter": ScreenplayFormatter,
    "SpineReport": SpineReport,
    "Terms": Terms,
    "UploadManuscript": UploadManuscript,
    "ViewReport": ViewReport,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};