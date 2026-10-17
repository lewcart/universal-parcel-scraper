# La Poste Burkina Faso

La Poste Burkina Faso parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

La Poste Burkina Faso, the national post formerly named SONAPOST, gives letters, parcels and
EMS items UPU S10 numbers ending in `BF`. Its tracking help page quotes this layout. Generic
postal detection handles these numbers, so no rule for La Poste Burkina Faso claims them.

## Links

The tracking help page links to an IPS Web Tracking form on webtracking.laposte.bf. The form
opens one item at `IPSWeb_item_events.aspx` with the number in the `itemid` parameter, and
lookups on the former webtracking.sonapost.bf host used the same address. The tracker is
served over plain HTTP only, so the catalog links neither the tracker nor a search page.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
