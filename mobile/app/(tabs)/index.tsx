import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/contexts/ThemeContext';
import { analyzeImage, analyzeImageUrl, AnalysisResult } from '../../src/lib/api';
import { getResultColor, getSealColor } from '../../src/lib/theme';

export default function UploadScreen() {
  const { t } = useTranslation();
  const { colors, colorScheme } = useTheme();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please allow access to your photo library');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setResult(null);
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please allow camera access');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setResult(null);
    }
  };

  const analyzeCurrentImage = async () => {
    if (!imageUri && !imageUrl) {
      Alert.alert('No image', 'Please select an image or enter a URL');
      return;
    }

    setIsAnalyzing(true);
    setResult(null);

    try {
      let analysisResult: AnalysisResult;

      if (imageUrl) {
        analysisResult = await analyzeImageUrl(imageUrl);
      } else if (imageUri) {
        const base64 = await FileSystem.readAsStringAsync(imageUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const mimeType = imageUri.toLowerCase().includes('.png') ? 'image/png' : 'image/jpeg';
        analysisResult = await analyzeImage(`data:${mimeType};base64,${base64}`);
      } else {
        throw new Error('No image available');
      }

      setResult(analysisResult);
    } catch (error: any) {
      Alert.alert('Analysis Error', error.message || 'Failed to analyze image');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const resetAnalysis = () => {
    setImageUri(null);
    setImageUrl('');
    setResult(null);
  };

  const getResultText = () => {
    if (!result) return '';
    switch (result.result) {
      case 'original':
        return t('result.original');
      case 'ai_generated':
        return t('result.ai_generated');
      case 'ai_modified':
        return t('result.ai_modified');
      default:
        return t('result.uncertain');
    }
  };

  const getResultIcon = () => {
    if (!result) return 'help-circle';
    switch (result.result) {
      case 'original':
        return 'checkmark-circle';
      case 'ai_generated':
        return 'warning';
      case 'ai_modified':
        return 'alert-circle';
      default:
        return 'help-circle';
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>
            {t('upload.title')}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {t('upload.subtitle')}
          </Text>
        </View>

        {!result ? (
          <>
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {imageUri ? (
                <View style={styles.imagePreview}>
                  <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="contain" />
                  <TouchableOpacity
                    style={[styles.removeButton, { backgroundColor: colors.destructive }]}
                    onPress={() => setImageUri(null)}
                  >
                    <Ionicons name="close" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.uploadButtons}>
                  <TouchableOpacity
                    style={[styles.uploadButton, { backgroundColor: colors.primary }]}
                    onPress={pickImage}
                  >
                    <Ionicons name="images-outline" size={24} color={colors.primaryForeground} />
                    <Text style={[styles.uploadButtonText, { color: colors.primaryForeground }]}>
                      {t('upload.selectImage')}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.uploadButton, { backgroundColor: colors.secondary }]}
                    onPress={takePhoto}
                  >
                    <Ionicons name="camera-outline" size={24} color={colors.text} />
                    <Text style={[styles.uploadButtonText, { color: colors.text }]}>
                      {t('upload.takePhoto')}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.urlSection}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  {t('upload.fromUrl')}
                </Text>
                <TextInput
                  style={[
                    styles.urlInput,
                    { backgroundColor: colors.secondary, color: colors.text, borderColor: colors.border },
                  ]}
                  placeholder={t('upload.urlPlaceholder')}
                  placeholderTextColor={colors.mutedForeground}
                  value={imageUrl}
                  onChangeText={setImageUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.analyzeButton,
                { backgroundColor: colors.primary },
                (!imageUri && !imageUrl) && styles.buttonDisabled,
              ]}
              onPress={analyzeCurrentImage}
              disabled={isAnalyzing || (!imageUri && !imageUrl)}
            >
              {isAnalyzing ? (
                <>
                  <ActivityIndicator color={colors.primaryForeground} />
                  <Text style={[styles.analyzeButtonText, { color: colors.primaryForeground }]}>
                    {t('upload.analyzing')}
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons name="scan" size={24} color={colors.primaryForeground} />
                  <Text style={[styles.analyzeButtonText, { color: colors.primaryForeground }]}>
                    {t('upload.analyze')}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={[styles.resultCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.resultHeader}>
                <Ionicons
                  name={getResultIcon() as any}
                  size={40}
                  color={getResultColor(result.result, colorScheme)}
                />
                <View style={styles.resultTextContainer}>
                  <Text style={[styles.resultTitle, { color: getResultColor(result.result, colorScheme) }]}>
                    {getResultText()}
                  </Text>
                  <Text style={[styles.resultConfidence, { color: colors.textSecondary }]}>
                    {t('result.confidence')}: {result.confidence}%
                  </Text>
                </View>
              </View>

              <View style={styles.progressContainer}>
                <View style={[styles.progressBar, { backgroundColor: colors.secondary }]}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        backgroundColor: getResultColor(result.result, colorScheme),
                        width: `${result.confidence}%`,
                      },
                    ]}
                  />
                </View>
              </View>

              {result.artifacts && Object.keys(result.artifacts).some((k) => result.artifacts?.[k as keyof typeof result.artifacts]) && (
                <View style={styles.artifactsSection}>
                  <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                    {t('result.artifacts')}
                  </Text>
                  <View style={styles.artifactsList}>
                    {Object.entries(result.artifacts).map(
                      ([key, value]) =>
                        value && (
                          <View key={key} style={[styles.artifactBadge, { backgroundColor: colors.secondary }]}>
                            <Text style={[styles.artifactText, { color: colors.text }]}>
                              {key.replace(/([A-Z])/g, ' $1').trim()}
                            </Text>
                          </View>
                        )
                    )}
                  </View>
                </View>
              )}

              {result.metadata && (
                <View style={styles.metadataSection}>
                  <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                    {t('result.metadata')}
                  </Text>
                  <View style={styles.metadataGrid}>
                    <View style={styles.metadataItem}>
                      <Text style={[styles.metadataLabel, { color: colors.textTertiary }]}>Dimensions</Text>
                      <Text style={[styles.metadataValue, { color: colors.text }]}>
                        {result.metadata.width} x {result.metadata.height}
                      </Text>
                    </View>
                    <View style={styles.metadataItem}>
                      <Text style={[styles.metadataLabel, { color: colors.textTertiary }]}>Format</Text>
                      <Text style={[styles.metadataValue, { color: colors.text }]}>
                        {result.metadata.format}
                      </Text>
                    </View>
                    <View style={styles.metadataItem}>
                      <Text style={[styles.metadataLabel, { color: colors.textTertiary }]}>EXIF</Text>
                      <Text style={[styles.metadataValue, { color: colors.text }]}>
                        {result.metadata.hasExif ? 'Yes' : 'No'}
                      </Text>
                    </View>
                    {result.metadata.cameraMake && (
                      <View style={styles.metadataItem}>
                        <Text style={[styles.metadataLabel, { color: colors.textTertiary }]}>Camera</Text>
                        <Text style={[styles.metadataValue, { color: colors.text }]}>
                          {result.metadata.cameraMake}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={[styles.newAnalysisButton, { backgroundColor: colors.secondary }]}
              onPress={resetAnalysis}
            >
              <Ionicons name="refresh" size={24} color={colors.text} />
              <Text style={[styles.newAnalysisButtonText, { color: colors.text }]}>
                {t('upload.newAnalysis')}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    marginBottom: 20,
  },
  imagePreview: {
    position: 'relative',
    marginBottom: 16,
  },
  previewImage: {
    width: '100%',
    height: 250,
    borderRadius: 12,
  },
  removeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  uploadButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  uploadButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  urlSection: {
    marginTop: 8,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '500',
  },
  urlInput: {
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
  },
  analyzeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 12,
    gap: 10,
  },
  analyzeButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  resultCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    marginBottom: 20,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
  },
  resultTextContainer: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  resultConfidence: {
    fontSize: 16,
  },
  progressContainer: {
    marginBottom: 20,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  artifactsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 12,
  },
  artifactsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  artifactBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  artifactText: {
    fontSize: 12,
    fontWeight: '500',
  },
  metadataSection: {},
  metadataGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metadataItem: {
    width: '48%',
  },
  metadataLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  metadataValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  newAnalysisButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 10,
  },
  newAnalysisButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
