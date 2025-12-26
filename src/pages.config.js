import ChapterReport from './pages/ChapterReport';
import Criteria from './pages/Criteria';
import Dashboard from './pages/Dashboard';
import Evaluate from './pages/Evaluate';
import EvaluateChapter from './pages/EvaluateChapter';
import History from './pages/History';
import Home from './pages/Home';
import ManuscriptDashboard from './pages/ManuscriptDashboard';
import Pricing from './pages/Pricing';
import Revise from './pages/Revise';
import ScreenplayFormatter from './pages/ScreenplayFormatter';
import SpineReport from './pages/SpineReport';
import UploadManuscript from './pages/UploadManuscript';
import ViewReport from './pages/ViewReport';
import Contact from './pages/Contact';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import __Layout from './Layout.jsx';


export const PAGES = {
    "ChapterReport": ChapterReport,
    "Criteria": Criteria,
    "Dashboard": Dashboard,
    "Evaluate": Evaluate,
    "EvaluateChapter": EvaluateChapter,
    "History": History,
    "Home": Home,
    "ManuscriptDashboard": ManuscriptDashboard,
    "Pricing": Pricing,
    "Revise": Revise,
    "ScreenplayFormatter": ScreenplayFormatter,
    "SpineReport": SpineReport,
    "UploadManuscript": UploadManuscript,
    "ViewReport": ViewReport,
    "Contact": Contact,
    "Privacy": Privacy,
    "Terms": Terms,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};