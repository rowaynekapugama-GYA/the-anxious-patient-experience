'use client'

import { TextField, useField } from '@payloadcms/ui'
import type { TextFieldClientProps } from 'payload'

type Counter = { ideal: number; warn: number }

export function CountedText(props: TextFieldClientProps) {
  const { path, field } = props
  const { value } = useField<string>({ path })
  const counter = (field as unknown as { custom?: { counter?: Counter } })?.custom?.counter
  const length = (value ?? '').length
  const tone = !counter ? '' : length > counter.warn ? 'is-over' : length > counter.ideal ? 'is-near' : 'is-ok'
  return (
    <div className="tnc-counted">
      <TextField {...props} />
      {counter ? (
        <span className={`tnc-counted__count ${tone}`}>
          {length} of about {counter.ideal} characters
        </span>
      ) : null}
    </div>
  )
}

export default CountedText
