import { BrowserRouter } from "react-router-dom";
import { Provider } from "react-redux";
import { AuthProvider } from "../context/AuthContext";
import { ThemeProvider } from "../context/ThemeContext";
import { UIProvider } from "../context/UIContext";
import { AppRoutes } from "../routes/AppRoutes";
import { store } from "../store";

const App = () => {
  return (
    <Provider store={store}>
      <ThemeProvider>
        <UIProvider>
          <AuthProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </AuthProvider>
        </UIProvider>
      </ThemeProvider>
    </Provider>
  );
};

export default App;
