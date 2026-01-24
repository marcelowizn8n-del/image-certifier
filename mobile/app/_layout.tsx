import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useTheme } from '../src/contexts/ThemeContext';
import { LanguageProvider } from '../src/contexts/LanguageContext';
import '../src/lib/i18n';

function RootLayoutNav() {
  const { colorScheme, colors } = useTheme();

  return (
    <>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <RootLayoutNav />
      </LanguageProvider>
    </ThemeProvider>
  );
}
