import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { useMainSwipe } from '@/context/MainSwipeContext';
import { type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/AppThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { getActiveDataBackend } from '@/lib/backend-config';
import { apiGetCongregacao, apiUpdateCongregacao } from '@/lib/api';

function OutlinedField({
  label,
  containerStyle,
  inputStyle,
  editable = true,
  ...inputProps
}: TextInputProps & { label: string; containerStyle?: object; inputStyle?: object }) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useAppTheme();
  return (
    <View style={[styles.outlineWrap, containerStyle, !editable && styles.outlineWrapDisabled]}>
      <Text style={styles.outlineLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[styles.outlineInput, inputStyle]}
        editable={editable}
        {...inputProps}
      />
    </View>
  );
}

export default function DadosEscolaScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { congregacaoId, nivelAcesso, patchCongregacaoEscola } = useAuth();
  const { requestPortalRefresh } = useMainSwipe();

  const canEdit = useMemo(() => {
    const n = String(nivelAcesso ?? '').toLowerCase();
    return n === 'admin' || n === 'super_admin';
  }, [nivelAcesso]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nome, setNome] = useState('');
  const [subtitulo, setSubtitulo] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [numero, setNumero] = useState('');
  const [bairro, setBairro] = useState('');
  const [estado, setEstado] = useState('');
  const [cidade, setCidade] = useState('');

  const load = useCallback(async () => {
    if (getActiveDataBackend() === null || congregacaoId == null || congregacaoId <= 0) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await apiGetCongregacao(congregacaoId);
      if (!res.ok) {
        Alert.alert('Dados da escola', res.error ?? 'Não foi possível carregar.');
        return;
      }
      const c = res.congregacao;
      setNome(c.nome);
      setSubtitulo(c.subtitulo ?? '');
      setLogradouro(c.logradouro ?? '');
      setNumero(c.numero ?? '');
      setBairro(c.bairro ?? '');
      setEstado(c.estado ?? '');
      setCidade(c.cidade ?? '');
    } catch {
      Alert.alert('Rede', 'Sem ligação ao servidor.');
    } finally {
      setLoading(false);
    }
  }, [congregacaoId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const handleAtualizar = async () => {
    if (!canEdit) {
      return;
    }
    const n = nome.trim();
    if (n.length < 2) {
      Alert.alert('Nome', 'Informe o nome da escola.');
      return;
    }
    if (getActiveDataBackend() === null || congregacaoId == null || congregacaoId <= 0) {
      Alert.alert('Dados da escola', 'Configure EXPO_PUBLIC_API_URL no .env.');
      return;
    }
    setSaving(true);
    try {
      const res = await apiUpdateCongregacao({
        congregacao_id: congregacaoId,
        nome: n,
        subtitulo: subtitulo.trim() || null,
        logradouro: logradouro.trim() || null,
        numero: numero.trim() || null,
        bairro: bairro.trim() || null,
        estado: estado.trim() || null,
        cidade: cidade.trim() || null,
      });
      if (!res.ok) {
        Alert.alert('Dados da escola', res.error ?? 'Não foi possível guardar.');
        return;
      }
      patchCongregacaoEscola({
        nome: n,
        subtitulo: subtitulo.trim() || null,
        bairro: bairro.trim() || null,
      });
      requestPortalRefresh();
      Alert.alert('Dados da escola', res.message ?? 'Atualizado com sucesso.');
    } catch {
      Alert.alert('Rede', 'Sem ligação ao servidor.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 8 : 0}
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.65 }]}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
          >
            <FontAwesome name="arrow-left" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Dados da escola</Text>
          <View style={styles.backPlaceholder} />
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(insets.bottom, 20) + 24 }]}
            showsVerticalScrollIndicator={false}
          >
            {!canEdit ? (
              <Text style={styles.readOnlyHint}>Apenas administradores podem alterar estes dados.</Text>
            ) : null}

            <Text style={styles.sectionTitle}>Perfil da escola</Text>
            <Text style={styles.sectionHelp}>
              O nome da escola é exibido para todos os administradores e professores na tela de resumo geral. Quando um
              subtítulo não é informado, o nome do bairro é exibido abaixo do nome da escola
            </Text>
            <OutlinedField label="nome" value={nome} onChangeText={setNome} editable={canEdit} autoCapitalize="words" />
            <OutlinedField
              label="subtítulo"
              value={subtitulo}
              onChangeText={setSubtitulo}
              editable={canEdit}
              placeholder="subtítulo"
            />

            <View style={styles.sectionRule} />

            <Text style={styles.sectionTitle}>Endereço</Text>
            <Text style={styles.sectionHelp}>
              Estas são as informações inseridas no cadastro da escola. Caso exista algum erro de ortografia entre em
              contato com o suporte
            </Text>
            <View style={styles.rowStreet}>
              <OutlinedField
                label="logradouro"
                containerStyle={styles.flex1}
                value={logradouro}
                onChangeText={setLogradouro}
                editable={canEdit}
                placeholder="logradouro"
              />
              <OutlinedField
                label="número"
                containerStyle={styles.numeroCol}
                value={numero}
                onChangeText={setNumero}
                editable={canEdit}
                placeholder="nº"
                keyboardType="numbers-and-punctuation"
              />
            </View>
            <OutlinedField label="bairro" value={bairro} onChangeText={setBairro} editable={canEdit} placeholder="bairro" />
            <View style={styles.rowStreet}>
              <OutlinedField
                label="estado"
                containerStyle={styles.estadoCol}
                value={estado}
                onChangeText={(t) => setEstado(t.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2))}
                editable={canEdit}
                placeholder="UF"
                maxLength={2}
                autoCapitalize="characters"
              />
              <OutlinedField
                label="cidade"
                containerStyle={styles.flex1}
                value={cidade}
                onChangeText={setCidade}
                editable={canEdit}
                placeholder="cidade"
              />
            </View>

            <Pressable
              onPress={() => void handleAtualizar()}
              disabled={!canEdit || saving}
              style={({ pressed }) => [
                styles.btnAtualizar,
                (!canEdit || saving) && styles.btnAtualizarDisabled,
                pressed && canEdit && !saving && { opacity: 0.9 },
              ]}
            >
              {saving ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={[styles.btnAtualizarText, !canEdit && styles.btnAtualizarTextDisabled]}>ATUALIZAR</Text>
              )}
            </Pressable>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  backBtn: {
    padding: 8,
    width: 40,
  },
  backPlaceholder: {
    width: 40,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  readOnlyHint: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 8,
  },
  sectionHelp: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 20,
    marginBottom: 16,
  },
  sectionRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 22,
  },
  outlineWrap: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 10,
    marginBottom: 14,
    backgroundColor: colors.background,
    position: 'relative',
  },
  outlineWrapDisabled: {
    opacity: 0.72,
  },
  outlineLabel: {
    position: 'absolute',
    top: -9,
    left: 12,
    backgroundColor: colors.background,
    paddingHorizontal: 6,
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
    zIndex: 1,
  },
  outlineInput: {
    fontSize: 15,
    color: colors.text,
    paddingVertical: 0,
    minHeight: 22,
  },
  rowStreet: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  flex1: {
    flex: 1,
    marginBottom: 14,
  },
  numeroCol: {
    width: 88,
    marginBottom: 14,
  },
  estadoCol: {
    width: 72,
    marginBottom: 14,
  },
  btnAtualizar: {
    marginTop: 20,
    backgroundColor: colors.primary,
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnAtualizarDisabled: {
    backgroundColor: colors.border,
  },
  btnAtualizarText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: 0.6,
  },
  btnAtualizarTextDisabled: {
    color: colors.textMuted,
  },
});
}
