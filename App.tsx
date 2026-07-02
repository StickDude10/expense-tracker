import React, { useEffect, useState } from 'react';
import { useColorScheme, LogBox } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Provider as PaperProvider, MD3LightTheme, MD3DarkTheme, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { initDb, getSetting } from './src/db/database';
import HomeScreen from './src/screens/HomeScreen';
import AddExpenseScreen from './src/screens/AddExpenseScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import AnalyticsScreen from './src/screens/AnalyticsScreen';
import SettingsScreen from './src/screens/SettingsScreen';

export const ThemeContext = React.createContext<{
  themePreference: 'light' | 'dark' | 'system';
  setThemePreference: (pref: 'light' | 'dark' | 'system') => void;
}>({
  themePreference: 'system',
  setThemePreference: () => {},
});

LogBox.ignoreLogs(['Non-serializable values were found in the navigation state']);

const Tab = createBottomTabNavigator();

export default function App() {
  const colorScheme = useColorScheme();
  const [themePreference, setThemePreferenceState] = useState<'light' | 'dark' | 'system'>('system');
  const [dbInitialized, setDbInitialized] = useState(false);

  const setThemePreference = (pref: 'light' | 'dark' | 'system') => {
    setThemePreferenceState(pref);
  };

  const activeScheme = themePreference === 'system' ? colorScheme : themePreference;
  const theme = activeScheme === 'dark' ? MD3DarkTheme : MD3LightTheme;

  useEffect(() => {
    try {
      initDb();
      
      const savedTheme = getSetting('theme_preference');
      if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') {
        setThemePreferenceState(savedTheme);
      }
      
      setDbInitialized(true);
    } catch (e) {
      console.error('Failed to initialize db', e);
    }
  }, []);

  if (!dbInitialized) {
    return (
      <PaperProvider theme={theme}>
        <ActivityIndicator style={{ flex: 1, justifyContent: 'center' }} size="large" />
      </PaperProvider>
    );
  }

  return (
    <ThemeContext.Provider value={{ themePreference, setThemePreference }}>
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
        <NavigationContainer theme={{
            ...(colorScheme === 'dark' ? DarkTheme : DefaultTheme),
            dark: colorScheme === 'dark',
            colors: {
              ...(colorScheme === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
              primary: theme.colors.primary,
              background: theme.colors.background,
              card: theme.colors.elevation.level2,
              text: theme.colors.onSurface,
              border: theme.colors.outline,
              notification: theme.colors.error,
            }
          }}>
          <Tab.Navigator
            screenOptions={({ route }) => ({
              tabBarIcon: ({ color, size }) => {
                let iconName: any = 'home';
                if (route.name === 'Home') iconName = 'view-dashboard';
                else if (route.name === 'Add Expense') iconName = 'plus-circle';
                else if (route.name === 'History') iconName = 'history';
                else if (route.name === 'Analytics') iconName = 'chart-line';
                else if (route.name === 'Settings') iconName = 'cog';
                return <MaterialCommunityIcons name={iconName} size={size} color={color} />;
              },
              tabBarActiveTintColor: theme.colors.primary,
              tabBarInactiveTintColor: 'gray',
              headerStyle: { backgroundColor: theme.colors.elevation.level2 },
              headerTintColor: theme.colors.onSurface,
              tabBarStyle: { backgroundColor: theme.colors.elevation.level2 },
            })}
          >
            <Tab.Screen name="Home" component={HomeScreen} />
            <Tab.Screen name="Add Expense" component={AddExpenseScreen} />
            <Tab.Screen name="History" component={HistoryScreen} />
            <Tab.Screen name="Analytics" component={AnalyticsScreen} />
            <Tab.Screen name="Settings" component={SettingsScreen} />
          </Tab.Navigator>
        </NavigationContainer>
      </PaperProvider>
    </SafeAreaProvider>
    </ThemeContext.Provider>
  );
}
