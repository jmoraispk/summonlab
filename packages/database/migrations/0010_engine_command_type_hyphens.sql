alter table summonlab_engine_commands
  drop constraint if exists summonlab_engine_commands_command_type_check;

alter table summonlab_engine_commands
  add constraint summonlab_engine_commands_command_type_check
  check (command_type ~ '^[a-z][a-z0-9.-]{2,99}$');
