import { useState, useRef, useEffect } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  Alert, RefreshControl, TextInput, Modal, KeyboardAvoidingView, Platform,
  FlatList, Linking, BackHandler,
} from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { useAuth } from '@clerk/clerk-expo'
import * as ImagePicker from 'expo-image-picker'
import { uploadAsync, FileSystemUploadType } from 'expo-file-system/legacy'
import { formatDistanceToNow, format } from 'date-fns'
import { api } from '../lib/api'
import { useTheme } from '../contexts/ThemeContext'
import { DashboardHome } from '../components/admin/DashboardHome'
import { SettingsSection } from '../components/admin/SettingsSection'
import { TeamSection } from '../components/admin/TeamSection'
import { ServicesSection } from '../components/admin/ServicesSection'
import { DocumentsSection } from '../components/admin/DocumentsSection'
import { VerificationsSection, ReportsSection, PlatformStatsSection } from '../components/admin/SuperAdminSections'

type AdminSection = 'home' | 'dashboard' | 'announcements' | 'events' | 'prayer' | 'videos' | 'messages' | 'polls' | 'followers' | 'settings' | 'team' | 'services' | 'documents' | 'verifications' | 'reports' | 'platform'

// ── Pill tab ─────────────────────────────────────────────────────────────────
function PillTab({ label, icon, active, onPress }: { label: string; icon: string; active: boolean; onPress: () => void }) {
  const { colors } = useTheme()
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
        backgroundColor: active ? colors.primary : colors.surface,
        borderWidth: 1, borderColor: active ? colors.primary : colors.border,
        marginRight: 8,
      }}
    >
      <Ionicons name={icon as any} size={14} color={active ? colors.primaryContrast : colors.textSecondary} />
      <Text style={{ fontSize: 13, fontWeight: '700', color: active ? colors.primaryContrast : colors.textSecondary }}>{label}</Text>
    </TouchableOpacity>
  )
}

// ── Announcements section ────────────────────────────────────────────────────
function AnnouncementsSection({ mosqueId }: { mosqueId: string }) {
  const { colors } = useTheme()
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ title: '', body: '', priority: 'NORMAL' as 'NORMAL' | 'IMPORTANT' | 'URGENT', isPinned: false })

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-announcements', mosqueId],
    queryFn: () => api.get(`/mosques/${mosqueId}/announcements?admin=1&limit=30`),
    staleTime: 0,
  })
  const items: any[] = data?.data?.items ?? []

  const createMutation = useMutation({
    mutationFn: () => api.post(`/mosques/${mosqueId}/announcements`, { ...form, sendNotification: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-announcements', mosqueId] })
      setShowCreate(false)
      setForm({ title: '', body: '', priority: 'NORMAL', isPinned: false })
    },
    onError: (e: any) => Alert.alert('Error', e.message ?? 'Could not create announcement.'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/announcements/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-announcements', mosqueId] }),
    onError: () => Alert.alert('Error', 'Could not delete announcement.'),
  })

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>Announcements</Text>
        <TouchableOpacity onPress={() => setShowCreate(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 }}>
          <Ionicons name="add" size={16} color={colors.primaryContrast} />
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primaryContrast }}>Post</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : items.length === 0 ? (
        <View style={{ alignItems: 'center', paddingTop: 60 }}>
          <Ionicons name="megaphone-outline" size={40} color={colors.textTertiary} />
          <Text style={{ color: colors.textTertiary, marginTop: 12, fontSize: 14 }}>No announcements yet</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingBottom: 100 }}
          renderItem={({ item }) => (
            <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    {item.priority !== 'NORMAL' && (
                      <View style={{ backgroundColor: item.priority === 'URGENT' ? '#FEE2E2' : '#FEF3C7', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: item.priority === 'URGENT' ? '#DC2626' : '#D97706' }}>{item.priority}</Text>
                      </View>
                    )}
                    {!item.isPublished && (
                      <View style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 10, fontWeight: '600', color: colors.textTertiary }}>DRAFT</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 3 }} numberOfLines={1}>{item.title}</Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 17 }} numberOfLines={2}>{item.body}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => Alert.alert('Delete', 'Delete this announcement?', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(item.id) },
                  ])}
                  style={{ padding: 6 }}
                >
                  <Ionicons name="trash-outline" size={16} color="#EF4444" />
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Text style={{ fontSize: 11, color: colors.textTertiary }}>{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}</Text>
                <Text style={{ fontSize: 11, color: colors.textTertiary }}>❤️ {item.likeCount ?? 0} · 💬 {item.commentCount ?? 0}</Text>
              </View>
            </View>
          )}
        />
      )}

      {/* Create modal */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <TouchableOpacity onPress={() => setShowCreate(false)}><Ionicons name="close" size={24} color={colors.text} /></TouchableOpacity>
              <Text style={{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: colors.text }}>New Announcement</Text>
              <TouchableOpacity onPress={() => { if (!form.title.trim() || !form.body.trim()) { Alert.alert('Required', 'Title and body are required'); return } createMutation.mutate() }} disabled={createMutation.isPending}>
                {createMutation.isPending ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={{ fontSize: 15, fontWeight: '700', color: colors.primary }}>Post</Text>}
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
              <TextInput
                style={{ backgroundColor: colors.inputBackground, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.text, borderWidth: 1, borderColor: colors.border, fontWeight: '700' }}
                placeholder="Announcement title…"
                placeholderTextColor={colors.textTertiary}
                value={form.title}
                onChangeText={(t) => setForm((f) => ({ ...f, title: t }))}
                maxLength={200}
              />
              <TextInput
                style={{ backgroundColor: colors.inputBackground, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: colors.text, borderWidth: 1, borderColor: colors.border, minHeight: 100 }}
                placeholder="Write your announcement…"
                placeholderTextColor={colors.textTertiary}
                value={form.body}
                onChangeText={(t) => setForm((f) => ({ ...f, body: t }))}
                multiline
                maxLength={2000}
              />
              <View>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>Priority</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {(['NORMAL', 'IMPORTANT', 'URGENT'] as const).map((p) => (
                    <TouchableOpacity
                      key={p}
                      onPress={() => setForm((f) => ({ ...f, priority: p }))}
                      style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: form.priority === p ? colors.primary : colors.surface, borderWidth: 1, borderColor: form.priority === p ? colors.primary : colors.border }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '700', color: form.priority === p ? colors.primaryContrast : colors.textSecondary }}>{p}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setForm((f) => ({ ...f, isPinned: !f.isPinned }))}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border }}
              >
                <Ionicons name={form.isPinned ? 'pin' : 'pin-outline'} size={18} color={form.isPinned ? colors.primary : colors.textSecondary} />
                <Text style={{ fontSize: 14, color: colors.text }}>Pin this announcement</Text>
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

// ── Events section ────────────────────────────────────────────────────────────
function EventsSection({ mosqueId }: { mosqueId: string }) {
  const { colors } = useTheme()
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', location: '', category: 'GENERAL' })
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)
  const [pickerField, setPickerField] = useState<'start' | 'end' | null>(null)
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date')
  const [tempDate, setTempDate] = useState<Date>(new Date())

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-events', mosqueId],
    queryFn: () => api.get(`/mosques/${mosqueId}/events?admin=1&limit=30`),
    staleTime: 0,
  })
  const items: any[] = data?.data?.items ?? []

  const createMutation = useMutation({
    mutationFn: () => {
      if (!startDate) throw new Error('Start time required')
      return api.post(`/mosques/${mosqueId}/events`, {
        title: form.title,
        description: form.description || undefined,
        location: form.location || undefined,
        category: form.category,
        startTime: startDate.toISOString(),
        endTime: endDate ? endDate.toISOString() : undefined,
        requiresRsvp: true,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-events', mosqueId] })
      setShowCreate(false)
      setForm({ title: '', description: '', location: '', category: 'GENERAL' })
      setStartDate(null)
      setEndDate(null)
    },
    onError: (e: any) => Alert.alert('Error', e.message ?? 'Could not create event.'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/events/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-events', mosqueId] }),
    onError: () => Alert.alert('Error', 'Could not delete event.'),
  })

  const CATEGORIES = ['GENERAL','HALAQA','YOUTH','SISTERS','JUMU_AH','EID','RAMADAN','FUNDRAISER','JANAZAH','COMMUNITY','EDUCATIONAL','OTHER']

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>Events</Text>
        <TouchableOpacity onPress={() => setShowCreate(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 }}>
          <Ionicons name="add" size={16} color={colors.primaryContrast} />
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primaryContrast }}>Create</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : items.length === 0 ? (
        <View style={{ alignItems: 'center', paddingTop: 60 }}>
          <Ionicons name="calendar-outline" size={40} color={colors.textTertiary} />
          <Text style={{ color: colors.textTertiary, marginTop: 12, fontSize: 14 }}>No events yet</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingBottom: 100 }}
          renderItem={({ item }) => (
            <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 3 }} numberOfLines={1}>{item.title}</Text>
                  <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600', marginBottom: 4 }}>
                    {format(new Date(item.startTime), 'MMM d, yyyy · h:mm a')}
                  </Text>
                  {item.location && <Text style={{ fontSize: 12, color: colors.textTertiary }} numberOfLines={1}>📍 {item.location}</Text>}
                  <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 4 }}>{item._count?.rsvps ?? 0} RSVPs · {item.category}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {item.isCancelled && <Text style={{ fontSize: 10, color: '#DC2626', fontWeight: '700' }}>CANCELLED</Text>}
                  <TouchableOpacity
                    onPress={() => Alert.alert('Delete', 'Delete this event?', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(item.id) },
                    ])}
                    style={{ padding: 6 }}
                  >
                    <Ionicons name="trash-outline" size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        />
      )}

      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <TouchableOpacity onPress={() => setShowCreate(false)}><Ionicons name="close" size={24} color={colors.text} /></TouchableOpacity>
              <Text style={{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: colors.text }}>New Event</Text>
              <TouchableOpacity onPress={() => { if (!form.title.trim() || !startDate) { Alert.alert('Required', 'Title and start time are required'); return } createMutation.mutate() }} disabled={createMutation.isPending}>
                {createMutation.isPending ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={{ fontSize: 15, fontWeight: '700', color: colors.primary }}>Create</Text>}
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
              {([
                { label: 'Title', key: 'title', placeholder: 'Event title…', multiline: false },
                { label: 'Description', key: 'description', placeholder: 'What is this event about?', multiline: true },
                { label: 'Location', key: 'location', placeholder: 'Address or online link…', multiline: false },
              ] as { label: string; key: keyof typeof form; placeholder: string; multiline: boolean }[]).map(({ label, key, placeholder, multiline }) => (
                <View key={key}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>{label}</Text>
                  <TextInput
                    style={{ backgroundColor: colors.inputBackground, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: colors.text, borderWidth: 1, borderColor: colors.border, ...(multiline ? { minHeight: 80 } : {}) }}
                    placeholder={placeholder}
                    placeholderTextColor={colors.textTertiary}
                    value={form[key]}
                    onChangeText={(t) => setForm((f) => ({ ...f, [key]: t }))}
                    multiline={multiline}
                  />
                </View>
              ))}

              {/* Start Time */}
              <View>
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>Start Time *</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => { const d = new Date(); d.setHours(18, 0, 0, 0); setStartDate(d) }}
                    style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: colors.primary }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary }}>Today</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => { setPickerField('start'); setPickerMode('date'); setTempDate(startDate ?? new Date()) }}
                    style={{ flex: 1, backgroundColor: colors.inputBackground, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: startDate ? colors.primary : colors.border, flexDirection: 'row', alignItems: 'center', gap: 8 }}
                  >
                    <Ionicons name="calendar-outline" size={16} color={startDate ? colors.primary : colors.textTertiary} />
                    <Text style={{ fontSize: 14, color: startDate ? colors.text : colors.textTertiary }}>
                      {startDate ? format(startDate, 'MMM d, yyyy · h:mm a') : 'Pick date & time…'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* End Time */}
              <View>
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>End Time (optional)</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {endDate && (
                    <TouchableOpacity
                      onPress={() => setEndDate(null)}
                      style={{ paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#EF4444' }}
                    >
                      <Ionicons name="close" size={16} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={() => { setPickerField('end'); setPickerMode('date'); setTempDate(endDate ?? startDate ?? new Date()) }}
                    style={{ flex: 1, backgroundColor: colors.inputBackground, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: endDate ? colors.primary : colors.border, flexDirection: 'row', alignItems: 'center', gap: 8 }}
                  >
                    <Ionicons name="time-outline" size={16} color={endDate ? colors.primary : colors.textTertiary} />
                    <Text style={{ fontSize: 14, color: endDate ? colors.text : colors.textTertiary }}>
                      {endDate ? format(endDate, 'MMM d, yyyy · h:mm a') : 'Pick end time…'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Native date/time picker */}
              {pickerField !== null && (
                Platform.OS === 'ios' ? (
                  <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
                        {pickerField === 'start' ? 'Start' : 'End'} — {pickerMode === 'date' ? 'Pick Date' : 'Pick Time'}
                      </Text>
                      <TouchableOpacity onPress={() => {
                        if (pickerMode === 'date') { setPickerMode('time') }
                        else {
                          if (pickerField === 'start') setStartDate(new Date(tempDate))
                          else setEndDate(new Date(tempDate))
                          setPickerField(null)
                          setPickerMode('date')
                        }
                      }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.primary }}>
                          {pickerMode === 'date' ? 'Next →' : 'Done ✓'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <DateTimePicker
                      value={tempDate}
                      mode={pickerMode}
                      display="spinner"
                      onChange={(_e: any, date?: Date) => { if (date) setTempDate(date) }}
                      textColor={colors.text}
                      style={{ width: '100%' }}
                    />
                  </View>
                ) : (
                  <DateTimePicker
                    value={tempDate}
                    mode={pickerMode}
                    display="default"
                    onChange={(e: any, date?: Date) => {
                      if (!date || e.type === 'dismissed') {
                        // User cancelled — close everything
                        setPickerField(null)
                        setPickerMode('date')
                        return
                      }
                      const updated = new Date(date)
                      setTempDate(updated)
                      if (pickerMode === 'date') {
                        // Auto-advance to time picker
                        setPickerMode('time')
                      } else {
                        // Done — save and close
                        if (pickerField === 'start') setStartDate(updated)
                        else setEndDate(updated)
                        setPickerField(null)
                        setPickerMode('date')
                      }
                    }}
                  />
                )
              )}
              <View>
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {CATEGORIES.map((c) => (
                      <TouchableOpacity key={c} onPress={() => setForm((f) => ({ ...f, category: c }))}
                        style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: form.category === c ? colors.primary : colors.surface, borderWidth: 1, borderColor: form.category === c ? colors.primary : colors.border }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: form.category === c ? colors.primaryContrast : colors.textSecondary }}>{c.replace('_', ' ')}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

// ── Videos section ────────────────────────────────────────────────────────────
function VideosSection({ mosqueId, isSuperAdmin }: { mosqueId: string | null; isSuperAdmin: boolean }) {
  const { colors } = useTheme()
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', category: 'GENERAL' })
  const [uploading, setUploading] = useState(false)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-videos', mosqueId ?? 'global'],
    queryFn: () =>
      isSuperAdmin && !mosqueId
        ? api.get('/super-admin/videos')
        : api.get(`/mosques/${mosqueId}/videos`),
    staleTime: 0,
  })
  const items: any[] = data?.data?.items ?? []

  const publishMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/videos/${id}/publish`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-videos', mosqueId] }),
    onError: () => Alert.alert('Error', 'Could not toggle publish status.'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/videos/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-videos', mosqueId] }),
    onError: () => Alert.alert('Error', 'Could not delete video.'),
  })

  async function handleUploadVideo() {
    if (!form.title.trim()) { Alert.alert('Required', 'Please enter a video title first.'); return }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) { Alert.alert('Permission required', 'Allow photo library access to upload videos.'); return }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 1 })
    if (result.canceled || !result.assets?.[0]) return

    setUploading(true)
    try {
      // Get Mux upload URL
      const endpoint = isSuperAdmin && !mosqueId
        ? '/super-admin/videos/upload'
        : `/mosques/${mosqueId}/videos/upload`
      const res = await api.post<any>(endpoint, { title: form.title, description: form.description || undefined, category: form.category })
      const { uploadUrl } = res.data

      // Upload directly to Mux using binary upload (fetch body doesn't support file URIs natively)
      const asset = result.assets[0]
      const uploadRes = await uploadAsync(uploadUrl, asset.uri, {
        httpMethod: 'PUT',
        mimeType: asset.mimeType ?? 'video/mp4',
        uploadType: FileSystemUploadType.BINARY_CONTENT,
      })

      if (uploadRes.status < 200 || uploadRes.status >= 300) throw new Error('Upload failed')

      queryClient.invalidateQueries({ queryKey: ['admin-videos', mosqueId] })
      setShowCreate(false)
      setForm({ title: '', description: '', category: 'GENERAL' })
      Alert.alert('Uploaded', 'Your video is processing. It will be available shortly.')
    } catch (e: any) {
      Alert.alert('Upload failed', e.message ?? 'Could not upload video. Try again.')
    } finally {
      setUploading(false)
    }
  }

  const VIDEO_CATEGORIES = ['GENERAL','LECTURE','QURAN','DUA','KHUTBAH','EDUCATIONAL','EVENT','OTHER']
  const STATUS_COLORS: Record<string, string> = { READY: '#059669', PROCESSING: '#D97706', ERROR: '#DC2626' }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
          {isSuperAdmin && !mosqueId ? 'Global Videos' : 'Videos'}
        </Text>
        <TouchableOpacity onPress={() => setShowCreate(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 }}>
          <Ionicons name="cloud-upload-outline" size={16} color={colors.primaryContrast} />
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primaryContrast }}>Upload</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : items.length === 0 ? (
        <View style={{ alignItems: 'center', paddingTop: 60 }}>
          <Ionicons name="videocam-outline" size={40} color={colors.textTertiary} />
          <Text style={{ color: colors.textTertiary, marginTop: 12, fontSize: 14 }}>No videos yet</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingBottom: 100 }}
          renderItem={({ item }) => (
            <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                {item.thumbnailUrl ? (
                  <Image source={{ uri: item.thumbnailUrl }} style={{ width: 80, height: 52, borderRadius: 8 }} contentFit="cover" />
                ) : (
                  <View style={{ width: 80, height: 52, borderRadius: 8, backgroundColor: colors.surfaceSecondary, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="film-outline" size={24} color={colors.textTertiary} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 3 }} numberOfLines={2}>{item.title}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Text style={{ fontSize: 11, color: STATUS_COLORS[item.status] ?? colors.textTertiary, fontWeight: '700' }}>{item.status}</Text>
                    <Text style={{ fontSize: 11, color: colors.textTertiary }}>{item.viewCount ?? 0} views</Text>
                    <Text style={{ fontSize: 11, color: colors.textTertiary }}>❤️ {item.likeCount ?? 0}</Text>
                  </View>
                </View>
                <View style={{ gap: 6 }}>
                  {item.status === 'READY' && (
                    <TouchableOpacity
                      onPress={() => publishMutation.mutate(item.id)}
                      style={{ backgroundColor: item.isPublished ? '#FEF3C7' : colors.primaryLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center' }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '700', color: item.isPublished ? '#D97706' : colors.primary }}>
                        {item.isPublished ? 'Unpublish' : 'Publish'}
                      </Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={() => Alert.alert('Delete', 'Delete this video?', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(item.id) },
                    ])}
                    style={{ padding: 6, alignItems: 'center' }}
                  >
                    <Ionicons name="trash-outline" size={15} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        />
      )}

      {/* Upload modal */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <TouchableOpacity onPress={() => setShowCreate(false)}><Ionicons name="close" size={24} color={colors.text} /></TouchableOpacity>
            <Text style={{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: colors.text }}>Upload Video</Text>
            <View style={{ width: 40 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
            <TextInput
              style={{ backgroundColor: colors.inputBackground, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.text, borderWidth: 1, borderColor: colors.border, fontWeight: '700' }}
              placeholder="Video title…"
              placeholderTextColor={colors.textTertiary}
              value={form.title}
              onChangeText={(t) => setForm((f) => ({ ...f, title: t }))}
              maxLength={200}
            />
            <TextInput
              style={{ backgroundColor: colors.inputBackground, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: colors.text, borderWidth: 1, borderColor: colors.border, minHeight: 80 }}
              placeholder="Description (optional)…"
              placeholderTextColor={colors.textTertiary}
              value={form.description}
              onChangeText={(t) => setForm((f) => ({ ...f, description: t }))}
              multiline
            />
            <View>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {VIDEO_CATEGORIES.map((c) => (
                    <TouchableOpacity key={c} onPress={() => setForm((f) => ({ ...f, category: c }))}
                      style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: form.category === c ? colors.primary : colors.surface, borderWidth: 1, borderColor: form.category === c ? colors.primary : colors.border }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: form.category === c ? colors.primaryContrast : colors.textSecondary }}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
            <TouchableOpacity
              onPress={handleUploadVideo}
              disabled={uploading}
              style={{ backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10 }}
            >
              {uploading ? (
                <><ActivityIndicator color={colors.primaryContrast} /><Text style={{ color: colors.primaryContrast, fontSize: 15, fontWeight: '700' }}>Uploading…</Text></>
              ) : (
                <><Ionicons name="cloud-upload-outline" size={20} color={colors.primaryContrast} /><Text style={{ color: colors.primaryContrast, fontSize: 15, fontWeight: '700' }}>Choose & Upload Video</Text></>
              )}
            </TouchableOpacity>
            <Text style={{ fontSize: 12, color: colors.textTertiary, textAlign: 'center', lineHeight: 17 }}>
              Videos are processed by Mux. Large files may take a few minutes before they appear in the feed.
            </Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  )
}

// ── Polls section ─────────────────────────────────────────────────────────────
function PollsSection({ mosqueId }: { mosqueId: string }) {
  const { colors } = useTheme()
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-polls', mosqueId],
    queryFn: () => api.get(`/mosques/${mosqueId}/polls`),
    staleTime: 0,
  })
  const items: any[] = data?.data?.items ?? []

  const createMutation = useMutation({
    mutationFn: () => {
      if (question.trim().length < 5) throw new Error('Question must be at least 5 characters')
      const validOptions = options.filter((o) => o.trim())
      if (validOptions.length < 2) throw new Error('At least 2 options required')
      return api.post(`/mosques/${mosqueId}/polls`, { question: question.trim(), options: validOptions, sendNotification: true })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-polls', mosqueId] })
      setShowCreate(false)
      setQuestion('')
      setOptions(['', ''])
    },
    onError: (e: any) => Alert.alert('Error', e.message ?? 'Could not create poll.'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/polls/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-polls', mosqueId] }),
    onError: () => Alert.alert('Error', 'Could not delete poll.'),
  })

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>Polls</Text>
        <TouchableOpacity onPress={() => setShowCreate(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 }}>
          <Ionicons name="add" size={16} color={colors.primaryContrast} />
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primaryContrast }}>Create</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : items.length === 0 ? (
        <View style={{ alignItems: 'center', paddingTop: 60 }}>
          <Ionicons name="bar-chart-outline" size={40} color={colors.textTertiary} />
          <Text style={{ color: colors.textTertiary, marginTop: 12, fontSize: 14 }}>No polls yet</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingBottom: 100 }}
          renderItem={({ item }) => (
            <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: colors.text }}>{item.question}</Text>
                <TouchableOpacity
                  onPress={() => Alert.alert('Delete', 'Delete this poll?', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(item.id) },
                  ])}
                  style={{ padding: 4 }}
                >
                  <Ionicons name="trash-outline" size={16} color="#EF4444" />
                </TouchableOpacity>
              </View>
              {item.options.map((opt: any) => {
                const pct = item.totalVotes > 0 ? Math.round((opt.voteCount / item.totalVotes) * 100) : 0
                return (
                  <View key={opt.id} style={{ marginBottom: 6 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                      <Text style={{ fontSize: 12, color: colors.textSecondary }}>{opt.text}</Text>
                      <Text style={{ fontSize: 12, color: colors.textTertiary, fontWeight: '600' }}>{pct}%</Text>
                    </View>
                    <View style={{ height: 6, backgroundColor: colors.surfaceSecondary, borderRadius: 3, overflow: 'hidden' }}>
                      <View style={{ height: 6, width: `${pct}%`, backgroundColor: colors.primary, borderRadius: 3 }} />
                    </View>
                  </View>
                )
              })}
              <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 6 }}>{item.totalVotes} total votes</Text>
            </View>
          )}
        />
      )}

      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <TouchableOpacity onPress={() => setShowCreate(false)}><Ionicons name="close" size={24} color={colors.text} /></TouchableOpacity>
              <Text style={{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: colors.text }}>New Poll</Text>
              <TouchableOpacity onPress={() => { if (!question.trim()) { Alert.alert('Required', 'Question is required'); return } createMutation.mutate() }} disabled={createMutation.isPending}>
                {createMutation.isPending ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={{ fontSize: 15, fontWeight: '700', color: colors.primary }}>Post</Text>}
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
              <TextInput
                style={{ backgroundColor: colors.inputBackground, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.text, borderWidth: 1, borderColor: colors.border, fontWeight: '700', minHeight: 80 }}
                placeholder="What do you want to ask?"
                placeholderTextColor={colors.textTertiary}
                value={question}
                onChangeText={setQuestion}
                multiline
                maxLength={300}
              />
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary }}>Options (min 2, max 6)</Text>
              {options.map((opt, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TextInput
                    style={{ flex: 1, backgroundColor: colors.inputBackground, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: colors.text, borderWidth: 1, borderColor: colors.border }}
                    placeholder={`Option ${i + 1}…`}
                    placeholderTextColor={colors.textTertiary}
                    value={opt}
                    onChangeText={(t) => setOptions((prev) => prev.map((o, j) => j === i ? t : o))}
                  />
                  {options.length > 2 && (
                    <TouchableOpacity onPress={() => setOptions((prev) => prev.filter((_, j) => j !== i))}>
                      <Ionicons name="remove-circle" size={22} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              {options.length < 6 && (
                <TouchableOpacity onPress={() => setOptions((prev) => [...prev, ''])} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                  <Text style={{ fontSize: 14, color: colors.primary, fontWeight: '600' }}>Add option</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

// ── Followers section ─────────────────────────────────────────────────────────
function FollowersSection({ mosqueId }: { mosqueId: string }) {
  const { colors } = useTheme()
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-followers', mosqueId],
    queryFn: () => api.get(`/mosques/${mosqueId}/followers?limit=50`),
    staleTime: 0,
  })
  const items: any[] = data?.data?.items ?? []
  const total: number = data?.data?.total ?? items.length

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>Followers</Text>
        <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>{total} total followers</Text>
      </View>
      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : items.length === 0 ? (
        <View style={{ alignItems: 'center', paddingTop: 60 }}>
          <Ionicons name="people-outline" size={40} color={colors.textTertiary} />
          <Text style={{ color: colors.textTertiary, marginTop: 12, fontSize: 14 }}>No followers yet</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id ?? i.userId}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 100 }}
          renderItem={({ item }) => {
            const user = item.user ?? item
            return (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border }}>
                {user.avatarUrl ? (
                  <Image source={{ uri: user.avatarUrl }} style={{ width: 40, height: 40, borderRadius: 20 }} contentFit="cover" />
                ) : (
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: colors.primary }}>{(user.name ?? '?')[0].toUpperCase()}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{user.name ?? 'Anonymous'}</Text>
                  {user.email && <Text style={{ fontSize: 12, color: colors.textTertiary }}>{user.email}</Text>}
                </View>
                {item.isFavorite && <Ionicons name="star" size={14} color="#F59E0B" />}
              </View>
            )
          }}
        />
      )}
    </View>
  )
}

// ── Prayer Times section ──────────────────────────────────────────────────────
const PRAYERS = [
  { key: 'fajr',    label: 'Fajr',    adhan: 'fajrAdhan',    iqamah: 'fajrIqamah' },
  { key: 'dhuhr',   label: 'Dhuhr',   adhan: 'dhuhrAdhan',   iqamah: 'dhuhrIqamah' },
  { key: 'asr',     label: 'Asr',     adhan: 'asrAdhan',     iqamah: 'asrIqamah' },
  { key: 'maghrib', label: 'Maghrib', adhan: 'maghribAdhan', iqamah: 'maghribIqamah' },
  { key: 'isha',    label: 'Isha',    adhan: 'ishaAdhan',    iqamah: 'ishaIqamah' },
]

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function PrayerTimesSection({ mosqueId }: { mosqueId: string }) {
  const { colors } = useTheme()
  const queryClient = useQueryClient()

  // Which date we're editing
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [tab, setTab] = useState<'daily' | 'jumuah' | 'taraweeh'>('daily')

  // Daily prayer times form
  const emptyTimes = { fajrAdhan: '', fajrIqamah: '', dhuhrAdhan: '', dhuhrIqamah: '', asrAdhan: '', asrIqamah: '', maghribAdhan: '', maghribIqamah: '', ishaAdhan: '', ishaIqamah: '', sunriseTime: '' }
  const [times, setTimes] = useState<Record<string, string>>(emptyTimes)

  // Jumu'ah form
  const [jumuahRows, setJumuahRows] = useState([{ khutbahTime: '', iqamahTime: '', language: 'English', imam: '' }])

  // Taraweeh form
  const [taraweehRows, setTaraweehRows] = useState([{ startTime: '', rakats: '20', imam: '' }])

  // Fetch saved times for selected date
  const { data: scheduleData, isLoading: scheduleLoading, refetch } = useQuery({
    queryKey: ['admin-prayer', mosqueId, selectedDate],
    queryFn: () => api.get(`/mosques/${mosqueId}/prayer-times?date=${selectedDate}`),
    staleTime: 0,
  })

  // Fetch Jumu'ah schedules
  const { data: jumuahData, refetch: refetchJumuah } = useQuery({
    queryKey: ['admin-jumuah', mosqueId],
    queryFn: () => api.get(`/mosques/${mosqueId}/jumuah`),
    staleTime: 0,
  })

  // Populate form when data loads
  const savedSchedule: any = scheduleData?.data ?? null
  const savedJumuah: any[] = jumuahData?.data?.items ?? jumuahData?.data ?? []

  // When saved schedule loads, fill form
  const [formLoaded, setFormLoaded] = useState('')
  if (savedSchedule && formLoaded !== selectedDate) {
    const next: Record<string, string> = { ...emptyTimes }
    for (const key of Object.keys(emptyTimes)) {
      next[key] = savedSchedule[key] ?? ''
    }
    setTimes(next)
    setFormLoaded(selectedDate)
  }
  if (!savedSchedule && formLoaded === selectedDate) {
    setTimes(emptyTimes)
    setFormLoaded('')
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, string | null> = { date: selectedDate }
      for (const [k, v] of Object.entries(times)) {
        payload[k] = v.match(/^\d{2}:\d{2}$/) ? v : null
      }
      return api.post(`/mosques/${mosqueId}/prayer-times`, payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-prayer', mosqueId, selectedDate] })
      Alert.alert('Saved', 'Prayer times updated.')
      refetch()
    },
    onError: (e: any) => Alert.alert('Error', e.message ?? 'Could not save.'),
  })

  const saveJumuahMutation = useMutation({
    mutationFn: () => {
      const valid = jumuahRows.filter((r) => r.khutbahTime.match(/^\d{2}:\d{2}$/) && r.iqamahTime.match(/^\d{2}:\d{2}$/))
      if (!valid.length) throw new Error('Add at least one valid row (HH:MM format)')
      return api.put(`/mosques/${mosqueId}/jumuah`, { schedules: valid.map((r) => ({ ...r, rakats: undefined })) })
    },
    onSuccess: () => { refetchJumuah(); Alert.alert('Saved', 'Jumu\'ah schedule updated.') },
    onError: (e: any) => Alert.alert('Error', e.message ?? 'Could not save.'),
  })

  const saveTaraweehMutation = useMutation({
    mutationFn: () => {
      const valid = taraweehRows.filter((r) => r.startTime.match(/^\d{2}:\d{2}$/))
      if (!valid.length) throw new Error('Add at least one valid row (HH:MM format)')
      return api.put(`/mosques/${mosqueId}/taraweeh`, { schedules: valid.map((r) => ({ startTime: r.startTime, rakats: Number(r.rakats) || 20, imam: r.imam || undefined })) })
    },
    onSuccess: () => Alert.alert('Saved', 'Taraweeh schedule updated.'),
    onError: (e: any) => Alert.alert('Error', e.message ?? 'Could not save.'),
  })

  const inputStyle = {
    flex: 1, backgroundColor: colors.inputBackground ?? colors.surfaceSecondary,
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 11,
    fontSize: 14, color: colors.text, borderWidth: 1, borderColor: colors.border,
    minWidth: 72,
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Sub-tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 12, paddingRight: 4, paddingVertical: 10, alignItems: 'center' }}>
        {([['daily', 'Daily Times'], ['jumuah', "Jumu'ah"], ['taraweeh', 'Taraweeh']] as const).map(([k, label]) => (
          <PillTab key={k} label={label} icon={k === 'daily' ? 'time-outline' : k === 'jumuah' ? 'people-outline' : 'moon-outline'} active={tab === k} onPress={() => setTab(k)} />
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">

        {/* ── Daily times ── */}
        {tab === 'daily' && (
          <>
            {/* Date selector */}
            <View>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>Date (YYYY-MM-DD)</Text>
              <TextInput
                style={{ backgroundColor: colors.inputBackground ?? colors.surfaceSecondary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: colors.text, borderWidth: 1, borderColor: colors.border }}
                value={selectedDate}
                onChangeText={(t) => { setSelectedDate(t); setFormLoaded('') }}
                placeholder="2026-04-01"
                placeholderTextColor={colors.textTertiary}
                maxLength={10}
              />
            </View>

            {scheduleLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                {/* Column headers */}
                <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 2 }}>
                  <Text style={{ width: 70, fontSize: 11, fontWeight: '700', color: colors.textTertiary }}>Prayer</Text>
                  <Text style={{ flex: 1, fontSize: 11, fontWeight: '700', color: colors.textTertiary, textAlign: 'center' }}>Adhan</Text>
                  <Text style={{ flex: 1, fontSize: 11, fontWeight: '700', color: colors.textTertiary, textAlign: 'center' }}>Iqamah</Text>
                </View>

                {PRAYERS.map(({ key, label, adhan, iqamah }) => (
                  <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ width: 70, fontSize: 13, fontWeight: '700', color: colors.text }}>{label}</Text>
                    <TextInput
                      style={inputStyle}
                      placeholder="05:30"
                      placeholderTextColor={colors.textTertiary}
                      value={times[adhan]}
                      onChangeText={(t) => setTimes((prev) => ({ ...prev, [adhan]: t }))}
                      maxLength={5}
                    />
                    <TextInput
                      style={inputStyle}
                      placeholder="05:45"
                      placeholderTextColor={colors.textTertiary}
                      value={times[iqamah]}
                      onChangeText={(t) => setTimes((prev) => ({ ...prev, [iqamah]: t }))}
                      maxLength={5}
                    />
                  </View>
                ))}

                {/* Sunrise */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ width: 70, fontSize: 13, fontWeight: '700', color: colors.textTertiary }}>Sunrise</Text>
                  <TextInput
                    style={inputStyle}
                    placeholder="06:45"
                    placeholderTextColor={colors.textTertiary}
                    value={times.sunriseTime}
                    onChangeText={(t) => setTimes((prev) => ({ ...prev, sunriseTime: t }))}
                    maxLength={5}
                  />
                  <View style={{ flex: 1 }} />
                </View>

                <Text style={{ fontSize: 11, color: colors.textTertiary, textAlign: 'center' }}>Use 24-hour format — e.g. 05:30, 13:15</Text>

                <TouchableOpacity
                  onPress={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                  style={{ backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                >
                  {saveMutation.isPending ? <ActivityIndicator color={colors.primaryContrast} /> : <Ionicons name="save-outline" size={18} color={colors.primaryContrast} />}
                  <Text style={{ color: colors.primaryContrast, fontSize: 15, fontWeight: '700' }}>
                    {saveMutation.isPending ? 'Saving…' : `Save Times for ${selectedDate}`}
                  </Text>
                </TouchableOpacity>

                {savedSchedule && (
                  <View style={{ backgroundColor: '#D1FAE5', borderRadius: 10, padding: 10, alignItems: 'center' }}>
                    <Text style={{ fontSize: 12, color: '#065F46', fontWeight: '600' }}>✓ Times saved for this date</Text>
                  </View>
                )}
              </>
            )}
          </>
        )}

        {/* ── Jumu'ah ── */}
        {tab === 'jumuah' && (
          <>
            <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 18 }}>
              Set up one or more Friday prayer sessions. Saving replaces all current Jumu'ah schedules.
            </Text>

            {jumuahRows.map((row, i) => (
              <View key={i} style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border, gap: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>Session {i + 1}</Text>
                  {jumuahRows.length > 1 && (
                    <TouchableOpacity onPress={() => setJumuahRows((prev) => prev.filter((_, j) => j !== i))}>
                      <Ionicons name="trash-outline" size={16} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>
                {[
                  { label: 'Khutbah Time (HH:MM)', key: 'khutbahTime', placeholder: '12:30' },
                  { label: 'Iqamah Time (HH:MM)', key: 'iqamahTime', placeholder: '13:00' },
                  { label: 'Language', key: 'language', placeholder: 'English' },
                  { label: 'Imam (optional)', key: 'imam', placeholder: 'Sheikh Ahmed' },
                ].map(({ label, key, placeholder }) => (
                  <View key={key}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary, marginBottom: 4 }}>{label}</Text>
                    <TextInput
                      style={{ backgroundColor: colors.inputBackground ?? colors.surfaceSecondary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text, borderWidth: 1, borderColor: colors.border }}
                      placeholder={placeholder}
                      placeholderTextColor={colors.textTertiary}
                      value={(row as any)[key]}
                      onChangeText={(t) => setJumuahRows((prev) => prev.map((r, j) => j === i ? { ...r, [key]: t } : r))}
                      maxLength={key.includes('Time') ? 5 : 100}
                    />
                  </View>
                ))}
              </View>
            ))}

            <TouchableOpacity onPress={() => setJumuahRows((prev) => [...prev, { khutbahTime: '', iqamahTime: '', language: 'English', imam: '' }])} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
              <Text style={{ fontSize: 14, color: colors.primary, fontWeight: '600' }}>Add another session</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => saveJumuahMutation.mutate()}
              disabled={saveJumuahMutation.isPending}
              style={{ backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
            >
              {saveJumuahMutation.isPending ? <ActivityIndicator color={colors.primaryContrast} /> : <Ionicons name="save-outline" size={18} color={colors.primaryContrast} />}
              <Text style={{ color: colors.primaryContrast, fontSize: 15, fontWeight: '700' }}>
                {saveJumuahMutation.isPending ? 'Saving…' : "Save Jumu'ah Schedule"}
              </Text>
            </TouchableOpacity>

            {savedJumuah.length > 0 && (
              <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border, gap: 8 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>Current Schedule</Text>
                {savedJumuah.map((s: any, i: number) => (
                  <View key={i} style={{ flexDirection: 'row', gap: 12 }}>
                    <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                      Session {i + 1}: Khutbah {s.khutbahTime} · Iqamah {s.iqamahTime} · {s.language}
                      {s.imam ? ` · ${s.imam}` : ''}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {/* ── Taraweeh ── */}
        {tab === 'taraweeh' && (
          <>
            <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 18 }}>
              Set Taraweeh prayer schedules for Ramadan. Saving replaces all current Taraweeh schedules.
            </Text>

            {taraweehRows.map((row, i) => (
              <View key={i} style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border, gap: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>Entry {i + 1}</Text>
                  {taraweehRows.length > 1 && (
                    <TouchableOpacity onPress={() => setTaraweehRows((prev) => prev.filter((_, j) => j !== i))}>
                      <Ionicons name="trash-outline" size={16} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>
                {[
                  { label: 'Start Time (HH:MM)', key: 'startTime', placeholder: '21:30' },
                  { label: 'Rakats', key: 'rakats', placeholder: '20' },
                  { label: 'Imam (optional)', key: 'imam', placeholder: 'Sheikh Ahmed' },
                ].map(({ label, key, placeholder }) => (
                  <View key={key}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary, marginBottom: 4 }}>{label}</Text>
                    <TextInput
                      style={{ backgroundColor: colors.inputBackground ?? colors.surfaceSecondary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text, borderWidth: 1, borderColor: colors.border }}
                      placeholder={placeholder}
                      placeholderTextColor={colors.textTertiary}
                      value={(row as any)[key]}
                      onChangeText={(t) => setTaraweehRows((prev) => prev.map((r, j) => j === i ? { ...r, [key]: t } : r))}
                      keyboardType={key === 'rakats' ? 'numeric' : 'default'}
                      maxLength={key === 'startTime' ? 5 : 50}
                    />
                  </View>
                ))}
              </View>
            ))}

            <TouchableOpacity onPress={() => setTaraweehRows((prev) => [...prev, { startTime: '', rakats: '20', imam: '' }])} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
              <Text style={{ fontSize: 14, color: colors.primary, fontWeight: '600' }}>Add another entry</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => saveTaraweehMutation.mutate()}
              disabled={saveTaraweehMutation.isPending}
              style={{ backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
            >
              {saveTaraweehMutation.isPending ? <ActivityIndicator color={colors.primaryContrast} /> : <Ionicons name="save-outline" size={18} color={colors.primaryContrast} />}
              <Text style={{ color: colors.primaryContrast, fontSize: 15, fontWeight: '700' }}>
                {saveTaraweehMutation.isPending ? 'Saving…' : 'Save Taraweeh Schedule'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  )
}

// ── Main dashboard ────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { colors } = useTheme()
  const { signOut } = useAuth()
  const queryClient = useQueryClient()
  const [selectedMosqueId, setSelectedMosqueId] = useState<string | null>(null)
  const [section, setSection] = useState<AdminSection>('home')

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-mosques'],
    queryFn: () => api.get<any>('/users/me/admin-mosques'),
    staleTime: 30_000,
  })

  // Intercept Android hardware back press when inside a mosque sub-section
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (selectedMosqueId || (section !== 'home')) {
        setSelectedMosqueId(null)
        setSection('home')
        return true  // consumed — don't exit app
      }
      return false  // let system handle (exit tab / app)
    })
    return () => handler.remove()
  }, [selectedMosqueId, section])

  const adminData = data?.data ?? {}
  const mosques: any[] = adminData.items ?? []
  const isSuperAdmin: boolean = adminData.isSuperAdmin ?? false
  const selectedMosque = selectedMosqueId ? mosques.find((m) => m.id === selectedMosqueId) : null

  function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut().then(() => router.replace('/(auth)/sign-in' as any)) },
    ])
  }

  // ── Loading ──
  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  // ── No access ──
  if (mosques.length === 0 && !isSuperAdmin) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <Text style={{ fontSize: 32, marginBottom: 16 }}>🕌</Text>
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 8 }}>No Mosque Access</Text>
          <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 }}>Contact your mosque to be added as an admin.</Text>
          <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={{ marginTop: 24, backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}>
            <Text style={{ color: colors.primaryContrast, fontWeight: '700' }}>Go to App</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  // ── Mosque sub-sections ──
  if (selectedMosque || (isSuperAdmin && section !== 'home')) {
    const SECTIONS: { key: AdminSection; label: string; icon: string }[] = selectedMosque ? [
      { key: 'dashboard', label: 'Dashboard', icon: 'grid-outline' },
      { key: 'announcements', label: 'Posts', icon: 'megaphone-outline' },
      { key: 'events', label: 'Events', icon: 'calendar-outline' },
      { key: 'prayer', label: 'Prayer', icon: 'time-outline' },
      { key: 'videos', label: 'Videos', icon: 'videocam-outline' },
      { key: 'polls', label: 'Polls', icon: 'bar-chart-outline' },
      { key: 'services', label: 'Services', icon: 'layers-outline' },
      { key: 'documents', label: 'Documents', icon: 'document-text-outline' },
      { key: 'team', label: 'Team', icon: 'people-circle-outline' },
      { key: 'followers', label: 'Followers', icon: 'people-outline' },
      { key: 'messages', label: 'Messages', icon: 'mail-outline' },
      { key: 'settings', label: 'Settings', icon: 'settings-outline' },
    ] : [
      { key: 'videos', label: 'Videos', icon: 'videocam-outline' },
      { key: 'verifications', label: 'Verifications', icon: 'checkmark-shield-outline' },
      { key: 'reports', label: 'Reports', icon: 'flag-outline' },
      { key: 'platform', label: 'Platform Stats', icon: 'stats-chart-outline' },
    ]

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <TouchableOpacity onPress={() => { setSelectedMosqueId(null); setSection('home') }} style={{ marginRight: 12, padding: 4 }}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }} numberOfLines={1}>
              {selectedMosque?.name ?? 'Global Admin'}
            </Text>
            {selectedMosque && <Text style={{ fontSize: 11, color: colors.textTertiary }}>{selectedMosque.city}, {selectedMosque.state}</Text>}
          </View>
          {selectedMosque && (
            <TouchableOpacity onPress={() => router.push(`/mosque/${selectedMosque.id}` as any)} style={{ padding: 6 }}>
              <Ionicons name="eye-outline" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Section tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ paddingLeft: 12, paddingRight: 4, paddingVertical: 10, alignItems: 'center' }}>
          {SECTIONS.map((s) => (
            <PillTab key={s.key} label={s.label} icon={s.icon} active={section === s.key} onPress={() => setSection(s.key)} />
          ))}
        </ScrollView>

        {/* Section content */}
        <View style={{ flex: 1 }}>
          {section === 'dashboard' && selectedMosque && (
            <DashboardHome mosqueId={selectedMosque.id} mosqueName={selectedMosque.name} onNavigate={(s) => setSection(s as AdminSection)} />
          )}
          {section === 'announcements' && selectedMosque && <AnnouncementsSection mosqueId={selectedMosque.id} />}
          {section === 'events' && selectedMosque && <EventsSection mosqueId={selectedMosque.id} />}
          {section === 'prayer' && selectedMosque && <PrayerTimesSection mosqueId={selectedMosque.id} />}
          {section === 'videos' && (
            <VideosSection mosqueId={selectedMosque?.id ?? null} isSuperAdmin={isSuperAdmin} />
          )}
          {section === 'polls' && selectedMosque && <PollsSection mosqueId={selectedMosque.id} />}
          {section === 'services' && selectedMosque && <ServicesSection mosqueId={selectedMosque.id} />}
          {section === 'documents' && selectedMosque && <DocumentsSection mosqueId={selectedMosque.id} />}
          {section === 'team' && selectedMosque && <TeamSection mosqueId={selectedMosque.id} />}
          {section === 'followers' && selectedMosque && <FollowersSection mosqueId={selectedMosque.id} />}
          {section === 'settings' && selectedMosque && <SettingsSection mosqueId={selectedMosque.id} />}
          {section === 'messages' && (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <Ionicons name="mail-outline" size={48} color={colors.textTertiary} />
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>Mosque Messages</Text>
              <TouchableOpacity
                onPress={() => router.push('/messages' as any)}
                style={{ backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}
              >
                <Text style={{ color: colors.primaryContrast, fontWeight: '700' }}>Open Messages</Text>
              </TouchableOpacity>
            </View>
          )}
          {section === 'verifications' && <VerificationsSection />}
          {section === 'reports' && <ReportsSection />}
          {section === 'platform' && <PlatformStatsSection />}
        </View>
      </SafeAreaView>
    )
  }

  // ── Mosque list (home) ──
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.4 }}>Admin Dashboard</Text>
          {isSuperAdmin && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <Ionicons name="shield-checkmark" size={12} color="#D97706" />
              <Text style={{ fontSize: 11, color: '#D97706', fontWeight: '700' }}>Super Admin</Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={{ marginRight: 4, padding: 8 }}>
          <Ionicons name="home-outline" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSignOut} style={{ padding: 8 }}>
          <Ionicons name="log-out-outline" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />}
      >
        {/* Super admin tools */}
        {isSuperAdmin && (
          <View style={{ backgroundColor: '#FEF3C7', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#F59E0B', gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Ionicons name="shield-checkmark" size={16} color="#D97706" />
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#92400E' }}>Super Admin Tools</Text>
            </View>
            {[
              { label: 'Upload Global Video', icon: 'videocam-outline', s: 'videos' as AdminSection, desc: 'Post to all users' },
              { label: 'Mosque Verifications', icon: 'checkmark-shield-outline', s: 'verifications' as AdminSection, desc: 'Approve pending mosques' },
              { label: 'Content Reports', icon: 'flag-outline', s: 'reports' as AdminSection, desc: 'Review flagged content' },
              { label: 'Platform Stats', icon: 'stats-chart-outline', s: 'platform' as AdminSection, desc: 'Users, mosques, activity' },
            ].map((a) => (
              <TouchableOpacity
                key={a.s}
                onPress={() => setSection(a.s)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFBEB', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#FDE68A' }}
              >
                <Ionicons name={a.icon as any} size={20} color="#D97706" />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#92400E' }}>{a.label}</Text>
                  <Text style={{ fontSize: 11, color: '#B45309' }}>{a.desc}</Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color="#D97706" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={{ fontSize: 14, color: colors.textSecondary }}>
          {mosques.length === 1 ? 'You manage 1 mosque' : `You manage ${mosques.length} mosques`}
        </Text>

        {mosques.map((mosque) => (
          <View
            key={mosque.id}
            style={{ backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 1, overflow: 'hidden' }}
          >
            {/* Tappable header — goes to dashboard */}
            <TouchableOpacity
              onPress={() => { setSelectedMosqueId(mosque.id); setSection('dashboard') }}
              activeOpacity={0.85}
              style={{ padding: 16 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                {mosque.logoUrl ? (
                  <Image source={{ uri: mosque.logoUrl }} style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 1, borderColor: colors.border }} contentFit="cover" />
                ) : (
                  <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 24 }}>🕌</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }} numberOfLines={1}>{mosque.name}</Text>
                    {mosque.isVerified && <Ionicons name="checkmark-circle" size={14} color={colors.primary} />}
                  </View>
                  <Text style={{ fontSize: 12, color: colors.textTertiary }}>{mosque.city}, {mosque.state}</Text>
                  <View style={{ backgroundColor: colors.primaryLight, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start', marginTop: 4 }}>
                    <Text style={{ fontSize: 10, color: colors.primary, fontWeight: '700' }}>{mosque.role}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
              </View>

              {/* Stats row */}
              <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 }}>
                {[
                  { label: 'Followers', value: mosque.followersCount ?? 0 },
                  { label: 'Events', value: mosque.eventsCount ?? 0 },
                  { label: 'Posts', value: mosque.announcementsCount ?? 0 },
                  { label: 'Videos', value: mosque.videosCount ?? 0 },
                ].map((stat, i) => (
                  <View key={stat.label} style={{ flex: 1, alignItems: 'center', borderLeftWidth: i > 0 ? 1 : 0, borderLeftColor: colors.border, paddingVertical: 4 }}>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>{stat.value}</Text>
                    <Text style={{ fontSize: 10, color: colors.textTertiary, marginTop: 1 }}>{stat.label}</Text>
                  </View>
                ))}
              </View>
            </TouchableOpacity>

            {/* Quick action pills — separate from card tap to avoid Android bubbling */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingBottom: 14, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 }}>
              {[
                { label: 'Posts', icon: 'megaphone-outline', s: 'announcements' as AdminSection },
                { label: 'Events', icon: 'calendar-outline', s: 'events' as AdminSection },
                { label: 'Prayer', icon: 'time-outline', s: 'prayer' as AdminSection },
                { label: 'Videos', icon: 'videocam-outline', s: 'videos' as AdminSection },
                { label: 'Services', icon: 'layers-outline', s: 'services' as AdminSection },
                { label: 'Documents', icon: 'document-text-outline', s: 'documents' as AdminSection },
                { label: 'Team', icon: 'people-circle-outline', s: 'team' as AdminSection },
                { label: 'Settings', icon: 'settings-outline', s: 'settings' as AdminSection },
              ].map((a) => (
                <TouchableOpacity
                  key={a.label}
                  onPress={() => { setSelectedMosqueId(mosque.id); setSection(a.s) }}
                  activeOpacity={0.8}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.surfaceSecondary, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: colors.border }}
                >
                  <Ionicons name={a.icon as any} size={13} color={colors.textSecondary} />
                  <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary }}>{a.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <TouchableOpacity
          onPress={() => router.replace('/(tabs)')}
          activeOpacity={0.7}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 }}
        >
          <Ionicons name="person-outline" size={16} color={colors.textSecondary} />
          <Text style={{ fontSize: 14, color: colors.textSecondary }}>Switch to User Mode</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}
