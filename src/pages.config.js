import Criteria from './pages/Criteria';
import Evaluate from './pages/Evaluate';
import History from './pages/History';
import Home from './pages/Home';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Criteria": Criteria,
    "Evaluate": Evaluate,
    "History": History,
    "Home": Home,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};