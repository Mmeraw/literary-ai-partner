import Home from './pages/Home';
import Evaluate from './pages/Evaluate';
import Criteria from './pages/Criteria';
import History from './pages/History';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Home": Home,
    "Evaluate": Evaluate,
    "Criteria": Criteria,
    "History": History,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};