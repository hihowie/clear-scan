import { Languages } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLocale } from '@/hooks/use-locale'
import { messages, selectLocale } from '@/lib/i18n'

export function LanguageButton() {
  const locale = useLocale()

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-10 px-2 sm:h-8 sm:px-3"
      aria-label={messages.switchLanguage}
      title={messages.switchLanguage}
      onClick={() => selectLocale(locale === 'zh-CN' ? 'en' : 'zh-CN')}
    >
      <Languages />
      <span lang={locale === 'zh-CN' ? 'en' : 'zh-CN'}>{locale === 'zh-CN' ? 'EN' : '中文'}</span>
    </Button>
  )
}
