<script setup lang="ts">
defineProps<{ kind: string }>();
</script>
<template>
  <svg viewBox="0 0 180 110" class="illustration" aria-hidden="true">
    <ellipse
      cx="90"
      cy="101"
      rx="72"
      ry="6"
      fill="currentColor"
      opacity=".08"
    />
    <g v-if="kind === 'house'">
      <path d="M38 96V52l47-34 48 34v44" fill="#f5e7c9" />
      <path d="M25 54L85 10l61 44-9 6-52-36-52 36" fill="#c68e6e" />
      <path d="M83 18v-8h16v18" fill="#a77b61" />
      <path d="M81 96V68h23v28" fill="#577366" />
      <path d="M49 57h20v22H49zM109 57h15v19h-15z" fill="#91b2ad" />
      <path d="M59 57v22M49 68h20" stroke="#faf5e8" stroke-width="3" />
      <path d="M151 98V45" stroke="#577366" stroke-width="5" />
      <ellipse cx="151" cy="57" rx="12" ry="29" fill="#92ab7b" />
      <path d="M25 98V63" stroke="#577366" stroke-width="4" />
      <ellipse cx="25" cy="73" rx="10" ry="23" fill="#afbf91" />
    </g>
    <g v-else-if="kind === 'car'">
      <path
        d="M30 79l10-32q4-13 20-13h48q14 0 24 15l13 22 10 5v20H24V82z"
        fill="#87aaa1"
      />
      <path d="M52 43h25v24H43zM84 43h24q9 0 18 24H84z" fill="#dfe8de" />
      <circle cx="51" cy="94" r="13" fill="#344d44" />
      <circle cx="51" cy="94" r="6" fill="#bccac0" />
      <circle cx="131" cy="94" r="13" fill="#344d44" />
      <circle cx="131" cy="94" r="6" fill="#bccac0" />
      <rect x="28" y="77" width="13" height="6" rx="2" fill="#f6eac4" />
      <rect x="139" y="77" width="12" height="6" rx="2" fill="#f6eac4" />
    </g>
    <g v-else-if="kind === 'basket'">
      <path d="M40 60h101l-13 39H52z" fill="#c49660" />
      <path
        d="M60 61q28-62 61 0"
        fill="none"
        stroke="#a17c52"
        stroke-width="6"
      />
      <path d="M58 59q-18-35 4-39 18 15 9 39" fill="#84a573" />
      <path d="M90 63q5-50 22-44 11 9-10 47" fill="#e2b36f" />
      <circle cx="120" cy="59" r="14" fill="#cc8d71" />
      <path
        d="M63 73l3 17m19-17v17m20-17-3 17m21-17-4 17"
        stroke="#f2ddab"
        stroke-width="5"
      />
    </g>
    <g v-else-if="kind === 'coffee'">
      <ellipse cx="78" cy="95" rx="45" ry="7" fill="#d4b99d" />
      <path d="M42 50h69v23q0 23-35 23T42 73z" fill="#faf2e5" />
      <ellipse cx="76" cy="50" rx="34" ry="10" fill="#9a7b63" />
      <path
        d="M111 56q35-7 21 22-9 10-22 2"
        fill="none"
        stroke="#e8d8c4"
        stroke-width="8"
      />
      <path
        d="M70 35q-10-10 0-21M88 35q-10-10 0-21"
        fill="none"
        stroke="#c9b29e"
        stroke-width="3"
      />
      <path d="M128 84l9-40 28 7-9 40z" fill="#e6aa94" />
      <path d="M141 64l8 12 7-9-6-9z" fill="#fff3de" />
    </g>
    <g v-else-if="kind === 'tools'">
      <rect x="28" y="32" width="85" height="57" rx="5" fill="#616b78" />
      <rect x="34" y="38" width="73" height="44" rx="2" fill="#394853" />
      <path
        d="M54 50l-10 10 10 10m32-20 10 10-10 10m-10-24-8 29"
        stroke="#e2e6d4"
        stroke-width="3"
        fill="none"
      />
      <path d="M20 91h101l-6 7H25z" fill="#a0a8a7" />
      <circle cx="139" cy="72" r="26" fill="#b2a2ca" />
      <path
        d="M136 84V58l15-4v24m-15-15 15-4"
        stroke="#fff9ed"
        stroke-width="4"
        fill="none"
      />
      <ellipse cx="130" cy="85" rx="7" ry="5" fill="#fff9ed" />
      <ellipse cx="145" cy="79" rx="7" ry="5" fill="#fff9ed" />
    </g>
    <g v-else>
      <path d="M45 37q44-17 90 0v28q-3 22-45 39-43-17-45-39z" fill="#8aaa8c" />
      <path
        d="M71 64l14 14 29-31"
        fill="none"
        stroke="#f6f4dd"
        stroke-width="7"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M27 89q-18-23-6-40 19 6 16 41m113 1q-5-30 12-39 13 22-5 43"
        fill="#b5c49b"
      />
    </g>
  </svg>
</template>
