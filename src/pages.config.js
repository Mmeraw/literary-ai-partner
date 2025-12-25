import Criteria from './pages/Criteria';
import Evaluate from './pages/Evaluate';
import History from './pages/History';
import Home from './pages/Home';
import Revise from './pages/Revise';
import ViewReport from './pages/ViewReport';
import UploadManuscript from './pages/UploadManuscript';
import ManuscriptDashboard from './pages/ManuscriptDashboard';
import SpineReport from './pages/SpineReport';
import EvaluateChapter from './pages/EvaluateChapter';
import ChapterReport from './pages/ChapterReport';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Criteria": Criteria,
    "Evaluate": Evaluate,
    "History": History,
    "Home": Home,
    "Revise": Revise,
    "ViewReport": ViewReport,
    "UploadManuscript": UploadManuscript,
    "ManuscriptDashboard": ManuscriptDashboard,
    "SpineReport": SpineReport,
    "EvaluateChapter": EvaluateChapter,
    "ChapterReport": ChapterReport,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};