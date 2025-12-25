import Criteria from './pages/Criteria';
import Evaluate from './pages/Evaluate';
import History from './pages/History';
import Home from './pages/Home';
import Revise from './pages/Revise';
import ViewReport from './pages/ViewReport';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Criteria": Criteria,
    "Evaluate": Evaluate,
    "History": History,
    "Home": Home,
    "Revise": Revise,
    "ViewReport": ViewReport,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};