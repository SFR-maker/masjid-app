import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, Linking } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import * as DocumentPicker from 'expo-document-picker'
import { api } from '../../lib/api'
import { useTheme } from '../../contexts/ThemeContext'
import { format } from 'date-fns'

function formatBytes(bytes: number) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function mimeIcon(mime?: string) {
  if (!mime) return 'document-outline'
  if (mime.includes('pdf')) return 'document-text-outline'
  if (mime.includes('image')) return 'image-outline'
  if (mime.includes('word') || mime.includes('document')) return 'document-outline'
  if (mime.includes('sheet') || mime.includes('excel')) return 'grid-outline'
  return 'document-outline'
}

export function DocumentsSection({ mosqueId }: { mosqueId: string }) {
  const { colors } = useTheme()
  const queryClient = useQueryClient()
  const [uploading, setUploading] = useState(false)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [newName, setNewName] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['mosque-documents', mosqueId],
    queryFn: () => api.get(`/mosques/${mosqueId}/documents`),
    staleTime: 30_000,
  })
  const docs: any[] = data?.data?.items ?? []

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/mosques/${mosqueId}/documents/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mosque-documents', mosqueId] }),
    onError: () => Alert.alert('Error', 'Could not delete document.'),
  })

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api.patch(`/mosques/${mosqueId}/documents/${id}`, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mosque-documents', mosqueId] })
      setRenaming(null)
      setNewName('')
    },
    onError: () => Alert.alert('Error', 'Could not rename document.'),
  })

  const uploadDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'image/*'],
        copyToCacheDirectory: true,
      })
      if (result.canceled || !result.assets?.[0]) return

      const asset = result.assets[0]
      setUploading(true)

      // Get signed upload params for raw/document files
      const paramsRes = await api.get(`/mosques/${mosqueId}/upload-params/raw`)
      const { signature, timestamp, cloudName, apiKey, folder } = paramsRes.data

      // Upload to Cloudinary as raw
      const formData = new FormData()
      formData.append('file', { uri: asset.uri, type: asset.mimeType ?? 'application/octet-stream', name: asset.name } as any)
      formData.append('signature', signature)
      formData.append('timestamp', String(timestamp))
      formData.append('api_key', apiKey)
      formData.append('folder', folder)
      formData.append('resource_type', 'raw')

      const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`, {
        method: 'POST',
        body: formData as any,
      })
      const uploadData = await uploadRes.json() as any
      if (!uploadData.secure_url) throw new Error('Upload failed')

      // Save to API
      await api.post(`/mosques/${mosqueId}/documents`, {
        name: asset.name,
        fileUrl: uploadData.secure_url,
        fileSize: asset.size,
        mimeType: asset.mimeType,
      })
      queryClient.invalidateQueries({ queryKey: ['mosque-documents', mosqueId] })
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>Documents</Text>
        <TouchableOpacity
          onPress={uploadDocument}
          disabled={uploading}
          activeOpacity={0.8}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, opacity: uploading ? 0.6 : 1 }}
        >
          {uploading ? <ActivityIndicator size="small" color={colors.primaryContrast} /> : <Ionicons name="cloud-upload-outline" size={15} color={colors.primaryContrast} />}
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primaryContrast }}>{uploading ? 'Uploading…' : 'Upload'}</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : docs.length === 0 ? (
        <View style={{ alignItems: 'center', paddingTop: 60, gap: 12 }}>
          <Ionicons name="folder-open-outline" size={40} color={colors.textTertiary} />
          <Text style={{ color: colors.textTertiary, fontSize: 14 }}>No documents uploaded yet</Text>
          <Text style={{ color: colors.textTertiary, fontSize: 12, textAlign: 'center', paddingHorizontal: 32 }}>Upload PDFs, Word docs, and more for your community</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingBottom: 100 }}>
          {docs.map((doc) => (
            <View key={doc.id} style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border }}>
              {renaming === doc.id ? (
                <View style={{ gap: 8 }}>
                  <TextInput
                    style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, color: colors.text, borderWidth: 1, borderColor: colors.border }}
                    value={newName}
                    onChangeText={setNewName}
                    autoFocus
                  />
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity onPress={() => { setRenaming(null); setNewName('') }} style={{ flex: 1, borderRadius: 10, paddingVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textSecondary }}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => renameMutation.mutate({ id: doc.id, name: newName })}
                      disabled={!newName.trim() || renameMutation.isPending}
                      activeOpacity={0.8}
                      style={{ flex: 1, borderRadius: 10, paddingVertical: 8, alignItems: 'center', backgroundColor: colors.primary, opacity: renameMutation.isPending ? 0.6 : 1 }}
                    >
                      {renameMutation.isPending
                        ? <ActivityIndicator size="small" color={colors.primaryContrast} />
                        : <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primaryContrast }}>Save</Text>
                      }
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 44, height: 44, backgroundColor: colors.primaryLight, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={mimeIcon(doc.mimeType) as any} size={22} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }} numberOfLines={1}>{doc.name}</Text>
                    <Text style={{ fontSize: 11, color: colors.textTertiary }}>
                      {format(new Date(doc.createdAt), 'MMM d, yyyy')}{doc.fileSize ? ` · ${formatBytes(doc.fileSize)}` : ''}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => Linking.openURL(doc.fileUrl)}
                      style={{ padding: 7, backgroundColor: colors.primaryLight, borderRadius: 8 }}
                    >
                      <Ionicons name="open-outline" size={16} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => { setRenaming(doc.id); setNewName(doc.name) }}
                      style={{ padding: 7, backgroundColor: colors.surfaceSecondary, borderRadius: 8 }}
                    >
                      <Ionicons name="pencil-outline" size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => Alert.alert('Delete', `Delete "${doc.name}"?`, [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(doc.id) },
                      ])}
                      style={{ padding: 7, backgroundColor: '#FEE2E2', borderRadius: 8 }}
                    >
                      <Ionicons name="trash-outline" size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  )
}
