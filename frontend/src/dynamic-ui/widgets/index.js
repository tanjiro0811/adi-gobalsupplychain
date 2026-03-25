import { Box, Button, Card, Grid, Heading, Stack, Text } from './basic'

export function registerBuiltInWidgets(registry) {
  registry
    .register('Box', Box)
    .register('Stack', Stack)
    .register('Grid', Grid)
    .register('Card', Card)
    .register('Text', Text)
    .register('Heading', Heading)
    .register('Button', Button)

  return registry
}

